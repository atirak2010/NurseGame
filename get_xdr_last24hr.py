import requests
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

# Configuration
XDR_API_URL = "https://api-csoc-plm.xdr.sg.paloaltonetworks.com"
API_KEY = "mYKcmCANq1jsnUcyUIOwn13wi6NqKH4QLeq46YxhvHYgvqp719dJa1kTl23yZ2WUyE7Y5AJb5HeyPdHSyL5fgFZte5a2dmFNzRBbt5J0DEfxiFiHiKdzkcwEplaGI7na"
API_KEY_ID = "11"


def get_xdr_headers():
    return {
        "x-xdr-auth-id": API_KEY_ID,
        "Authorization": API_KEY,
        "Content-Type": "application/json",
    }


def fmt(epoch_ms):
    if epoch_ms:
        return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return "N/A"


def fmt_hour(epoch_ms):
    if epoch_ms:
        return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:00")
    return "N/A"


def get_incidents_time_range(hours=24):
    """Fetch all incidents from the last N hours with pagination."""
    now = datetime.now(timezone.utc)
    time_ago = now - timedelta(hours=hours)
    ts_from = int(time_ago.timestamp() * 1000)
    ts_to = int(now.timestamp() * 1000)

    print(f"  Time window: {fmt(ts_from)} -> {fmt(ts_to)}")

    all_incidents = []
    offset = 0
    page_size = 100
    total_count = None

    while True:
        body = {
            "request_data": {
                "filters": [
                    {"field": "creation_time", "operator": "gte", "value": ts_from},
                    {"field": "creation_time", "operator": "lte", "value": ts_to},
                ],
                "search_from": offset,
                "search_to": offset + page_size,
                "sort": {"field": "creation_time", "keyword": "desc"},
            }
        }

        resp = requests.post(
            f"{XDR_API_URL}/public_api/v1/incidents/get_incidents",
            headers=get_xdr_headers(),
            json=body,
        )

        if resp.status_code != 200:
            print(f"  Error: HTTP {resp.status_code} - {resp.text}")
            return None

        data = resp.json()
        incidents = data.get("reply", {}).get("incidents", [])
        if total_count is None:
            total_count = data.get("reply", {}).get("total_count", 0)

        all_incidents.extend(incidents)
        print(f"  Page {offset // page_size + 1}: fetched {len(incidents)} (total so far: {len(all_incidents)} / {total_count})")

        if len(incidents) < page_size:
            break
        offset += page_size

    return {"incidents": all_incidents, "total_count": total_count}


def get_incident_extra_data(incident_id):
    body = {
        "request_data": {
            "incident_id": str(incident_id),
            "alerts_limit": 50,
        }
    }
    resp = requests.post(
        f"{XDR_API_URL}/public_api/v1/incidents/get_incident_extra_data",
        headers=get_xdr_headers(),
        json=body,
    )
    if resp.status_code != 200:
        return None
    return resp.json().get("reply")


if __name__ == "__main__":
    HOURS = 24

    print("=" * 100)
    print(f"CORTEX XDR - LAST {HOURS} HOURS INCIDENT ANALYSIS")
    print("=" * 100)
    print(f"Run time: {fmt(int(datetime.now(timezone.utc).timestamp() * 1000))}")
    print()

    # =========================================================================
    # Step 1: Fetch incidents
    # =========================================================================
    print(f"[1/3] Fetching incidents from the last {HOURS} hours...")
    result = get_incidents_time_range(hours=HOURS)

    if not result:
        print("Failed to fetch incidents.")
        exit(1)

    incidents = result["incidents"]
    total = result["total_count"]
    print(f"\n  Total incidents in last {HOURS}h: {total}")
    print(f"  Retrieved: {len(incidents)}")

    if not incidents:
        print(f"\n  No incidents in the last {HOURS} hours.")
        exit(0)

    with open("incidents_24hr_raw.json", "w") as f:
        json.dump(incidents, f, indent=2)
    print("  Saved: incidents_24hr_raw.json")

    # =========================================================================
    # Step 2: Fetch detailed data
    # =========================================================================
    print(f"\n[2/3] Fetching detailed extra data for {len(incidents)} incidents...")
    detailed = []
    failed_count = 0
    for idx, inc in enumerate(incidents, 1):
        iid = inc.get("incident_id")
        if idx % 50 == 0 or idx == len(incidents):
            print(f"  Progress: {idx}/{len(incidents)} ({idx / len(incidents) * 100:.0f}%)")
        d = get_incident_extra_data(iid)
        if d:
            detailed.append(d)
        else:
            failed_count += 1

    print(f"  Done: {len(detailed)} OK, {failed_count} failed")

    with open("incidents_24hr_detailed.json", "w") as f:
        json.dump(detailed, f, indent=2)
    print("  Saved: incidents_24hr_detailed.json")

    # =========================================================================
    # Step 3: Analysis
    # =========================================================================
    print(f"\n[3/3] Analyzing {len(incidents)} incidents...\n")

    # --- Collect all alerts ---
    all_alerts = []
    for d in detailed:
        all_alerts.extend(d.get("alerts", {}).get("data", []))

    # --- Basic counters ---
    severities = Counter(i.get("severity", "unknown") for i in incidents)
    statuses = Counter(i.get("status", "unknown") for i in incidents)
    sources = Counter(s for i in incidents for s in i.get("incident_sources", []))

    alert_names = Counter()
    for i in incidents:
        desc = i.get("description", "")
        name = desc.split("generated by")[0].strip().strip("'") if "generated by" in desc else desc
        alert_names[name] += 1

    host_set = set()
    for i in incidents:
        for h in i.get("hosts", []):
            host_set.add(h)

    actions = Counter(a.get("action_pretty", a.get("action", "unknown")) for a in all_alerts)
    categories = Counter(a.get("category", "unknown") for a in all_alerts)
    tactics = Counter(a.get("mitre_tactic_id_and_name") for a in all_alerts if a.get("mitre_tactic_id_and_name"))
    techniques = Counter(a.get("mitre_technique_id_and_name") for a in all_alerts if a.get("mitre_technique_id_and_name"))

    ext_hosts = Counter(a.get("action_external_hostname") for a in all_alerts if a.get("action_external_hostname"))
    remote_ips = Counter(a.get("action_remote_ip") for a in all_alerts if a.get("action_remote_ip"))
    local_ips = Counter(a.get("action_local_ip") for a in all_alerts if a.get("action_local_ip"))
    remote_ports = Counter(a.get("action_remote_port") for a in all_alerts if a.get("action_remote_port"))

    net_countries = Counter()
    for d in detailed:
        for art in d.get("network_artifacts", {}).get("data", []):
            c = art.get("network_country")
            if c:
                net_countries[c] += 1

    all_file_arts = []
    for d in detailed:
        all_file_arts.extend(d.get("file_artifacts", {}).get("data", []))

    detected_only = [a for a in all_alerts
                     if "Detected" in a.get("action_pretty", "") or "Allowed" in a.get("action_pretty", "")]
    high_incidents = [i for i in incidents if i.get("severity") in ("high", "critical")]
    total_blocked = sum(c for a, c in actions.items() if "Prevented" in a or "Blocked" in a)
    total_detected = sum(c for a, c in actions.items() if "Detected" in a or "Allowed" in a)

    # --- Hourly distribution ---
    hourly_dist = Counter()
    hourly_severity = defaultdict(Counter)
    hourly_alert_type = defaultdict(Counter)
    for i in incidents:
        hour = fmt_hour(i.get("creation_time"))
        hourly_dist[hour] += 1
        hourly_severity[hour][i.get("severity", "unknown")] += 1
        desc = i.get("description", "")
        name = desc.split("generated by")[0].strip().strip("'") if "generated by" in desc else desc
        hourly_alert_type[hour][name] += 1

    # =========================================================================
    # PRINT REPORT
    # =========================================================================

    print("=" * 100)
    print("INCIDENT OVERVIEW")
    print("=" * 100)

    print(f"\n  Total Incidents      : {len(incidents)}")
    print(f"  Total Alerts         : {len(all_alerts)}")
    print(f"  Unique Hosts/IPs     : {len(host_set)}")
    print(f"  Time Range           : {fmt(incidents[-1].get('creation_time'))} -> {fmt(incidents[0].get('creation_time'))}")
    print(f"  Avg Incidents/Hour   : {len(incidents) / HOURS:.1f}")

    print(f"\n--- Severity ---")
    for sev in ["critical", "high", "medium", "low", "informational"]:
        if sev in severities:
            pct = severities[sev] / len(incidents) * 100
            bar = "#" * int(pct / 2)
            print(f"  {sev:<14}: {severities[sev]:>5} ({pct:5.1f}%)  {bar}")

    print(f"\n--- Status ---")
    for status, count in statuses.most_common():
        print(f"  {status:<35}: {count:>5} ({count / len(incidents) * 100:5.1f}%)")

    print(f"\n--- Incident Sources ---")
    for src, count in sources.most_common():
        print(f"  {src:<30}: {count:>5}")

    # --- Hourly distribution ---
    print("\n" + "=" * 100)
    print("HOURLY DISTRIBUTION")
    print("=" * 100)

    print(f"\n  {'Hour':<20} {'Total':>6} {'High':>6} {'Med':>6} | Top Alert")
    print(f"  {'-'*20} {'-'*6} {'-'*6} {'-'*6} + {'-'*40}")
    for hour in sorted(hourly_dist.keys()):
        total_h = hourly_dist[hour]
        high_h = hourly_severity[hour].get("high", 0) + hourly_severity[hour].get("critical", 0)
        med_h = hourly_severity[hour].get("medium", 0)
        top_alert = hourly_alert_type[hour].most_common(1)[0][0] if hourly_alert_type[hour] else "N/A"
        top_count = hourly_alert_type[hour].most_common(1)[0][1] if hourly_alert_type[hour] else 0
        bar = "|" * total_h
        print(f"  {hour:<20} {total_h:>6} {high_h:>6} {med_h:>6} | {top_alert[:35]} ({top_count}x)  {bar}")

    # --- Top alert types ---
    print("\n" + "=" * 100)
    print("TOP ALERT TYPES")
    print("=" * 100)

    for name, count in alert_names.most_common(25):
        pct = count / len(incidents) * 100
        bar = "#" * max(1, int(pct / 2))
        print(f"  {count:>5}x ({pct:5.1f}%)  {name}")

    # --- Detailed alert analysis ---
    print("\n" + "=" * 100)
    print("DETAILED ALERT ANALYSIS")
    print("=" * 100)

    print(f"\n  Total alerts: {len(all_alerts)}")

    print(f"\n--- Alert Actions ---")
    for action, count in actions.most_common():
        blocked = "BLOCKED" if "Prevented" in action or "Blocked" in action else "DETECT"
        print(f"  [{blocked:>7}] {count:>5}x  {action}")

    if detected_only:
        print(f"\n  *** WARNING: {len(detected_only)} alerts were DETECTED but NOT BLOCKED ***")
        print(f"  These require immediate investigation:")
        for a in detected_only:
            print(f"    - Alert {a.get('alert_id')}: {a.get('name')}")
            print(f"      Host: {a.get('host_ip')} | Action: {a.get('action_pretty')} | Severity: {a.get('severity')}")
            print(f"      Time: {fmt(a.get('detection_timestamp'))}")
            if a.get("action_process_image_name"):
                print(f"      Process: {a.get('action_process_image_name')} | CMD: {a.get('action_process_image_command_line', 'N/A')}")
            if a.get("actor_process_image_name"):
                print(f"      Actor: {a.get('actor_process_image_name')} | CMD: {a.get('actor_process_command_line', 'N/A')}")
            if a.get("action_file_path"):
                print(f"      File: {a.get('action_file_path')}")
            if a.get("action_file_sha256"):
                print(f"      SHA256: {a.get('action_file_sha256')}")

    print(f"\n--- Alert Categories ---")
    for cat, count in categories.most_common():
        print(f"  {cat:<45}: {count:>5}")

    if tactics:
        print(f"\n--- MITRE ATT&CK Tactics ---")
        for t, count in tactics.most_common():
            print(f"  {count:>5}x  {t}")
    else:
        print(f"\n--- MITRE ATT&CK Tactics ---")
        print("  None mapped")

    if techniques:
        print(f"\n--- MITRE ATT&CK Techniques ---")
        for t, count in techniques.most_common():
            print(f"  {count:>5}x  {t}")

    # --- Network analysis ---
    print("\n" + "=" * 100)
    print("NETWORK ANALYSIS")
    print("=" * 100)

    print(f"\n--- Top 30 External Hostnames (Attackers) ---")
    for h, count in ext_hosts.most_common(30):
        print(f"  {count:>5}x  {h}")

    print(f"\n--- Top 30 Remote IPs (Targets) ---")
    for ip, count in remote_ips.most_common(30):
        print(f"  {count:>5}x  {ip}")

    print(f"\n--- Top 20 Local IPs ---")
    for ip, count in local_ips.most_common(20):
        print(f"  {count:>5}x  {ip}")

    print(f"\n--- Target Ports ---")
    for port, count in remote_ports.most_common(15):
        print(f"  {count:>5}x  port {port}")

    print(f"\n--- Source Countries ---")
    for c, count in net_countries.most_common():
        pct = count / sum(net_countries.values()) * 100 if net_countries else 0
        print(f"  {c:<6}: {count:>5} ({pct:5.1f}%)")

    # --- Attacker IP subnet analysis ---
    print(f"\n--- Attacker Subnet Analysis (/24) ---")
    subnet_counter = Counter()
    for h in ext_hosts:
        parts = h.split(".")
        if len(parts) == 4:
            subnet = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"
            subnet_counter[subnet] += ext_hosts[h]
    for subnet, count in subnet_counter.most_common(15):
        print(f"  {count:>5}x  {subnet}")

    # --- File artifacts ---
    print("\n" + "=" * 100)
    print("FILE ARTIFACTS")
    print("=" * 100)

    if all_file_arts:
        print(f"\n  Total file artifacts: {len(all_file_arts)}")
        verdicts = Counter(a.get("file_wildfire_verdict", "unknown") for a in all_file_arts)
        print(f"\n--- Wildfire Verdicts ---")
        for v, count in verdicts.most_common():
            print(f"  {v:<20}: {count:>5}")

        print(f"\n--- File Details ---")
        for a in all_file_arts:
            sha = a.get("file_sha256", "N/A")
            sha_short = sha[:40] + "..." if sha and len(sha) > 40 else (sha or "N/A")
            fname = a.get("file_name") or "N/A"
            verdict = a.get("file_wildfire_verdict") or "N/A"
            print(f"  {fname:<30} | {verdict:<12} | {sha_short}")
    else:
        print("\n  No file artifacts found.")

    # --- High/Critical severity detail ---
    if high_incidents:
        print("\n" + "=" * 100)
        print(f"HIGH/CRITICAL SEVERITY INCIDENTS ({len(high_incidents)})")
        print("=" * 100)
        for i in high_incidents:
            desc = i.get("description", "N/A")
            print(f"\n  ID: {i.get('incident_id')} | Severity: {i.get('severity')} | Status: {i.get('status')}")
            print(f"  Created : {fmt(i.get('creation_time'))}")
            print(f"  Desc    : {desc}")
            print(f"  Hosts   : {', '.join(i.get('hosts', [])) if i.get('hosts') else 'N/A'}")
            print(f"  Source  : {', '.join(i.get('incident_sources', []))}")
            print(f"  Alerts  : {i.get('alert_count', 0)} (High: {i.get('high_severity_alert_count', 0)})")
            print(f"  XDR URL : {i.get('xdr_url', 'N/A')}")

    # --- Executive summary ---
    print("\n" + "=" * 100)
    print("EXECUTIVE SUMMARY")
    print("=" * 100)
    print(f"""
  Time Period            : Last {HOURS} hours
  Total Incidents        : {len(incidents)}
  Total Alerts           : {len(all_alerts)}
  Avg Incidents/Hour     : {len(incidents) / HOURS:.1f}
  Blocked Alerts         : {total_blocked}
  Detected (not blocked) : {total_detected}
  High/Critical          : {len(high_incidents)} ({len(high_incidents) / len(incidents) * 100:.1f}%)
  Unique Hosts           : {len(host_set)}
  File Artifacts         : {len(all_file_arts)}
  Top Threat             : {alert_names.most_common(1)[0][0] if alert_names else 'N/A'} ({alert_names.most_common(1)[0][1] if alert_names else 0}x)
  Top Source Country     : {net_countries.most_common(1)[0][0] if net_countries else 'N/A'} ({net_countries.most_common(1)[0][1] if net_countries else 0}x)
  Top Attacker Subnet    : {subnet_counter.most_common(1)[0][0] if subnet_counter else 'N/A'} ({subnet_counter.most_common(1)[0][1] if subnet_counter else 0}x)

  RISK ASSESSMENT:""")

    if total_detected > 0:
        print(f"  [!!!] CRITICAL: {total_detected} alerts detected but NOT blocked - INVESTIGATE IMMEDIATELY")
    if len(high_incidents) > 20:
        print(f"  [!!]  HIGH: {len(high_incidents)} high/critical incidents - review and triage needed")
    elif len(high_incidents) > 0:
        print(f"  [!]   ELEVATED: {len(high_incidents)} high/critical incidents present")
    if len(incidents) / HOURS > 50:
        print(f"  [!!]  HIGH: Incident rate ({len(incidents) / HOURS:.1f}/hr) is elevated - possible active campaign")
    print()

    print(f"Files saved:")
    print(f"  - incidents_24hr_raw.json       ({len(incidents)} incidents, basic data)")
    print(f"  - incidents_24hr_detailed.json   ({len(detailed)} incidents, full extra data)")
