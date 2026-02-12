import requests
import hashlib
import secrets
import json
from datetime import datetime, timezone

# Configuration
XDR_API_URL = "https://api-csoc-plm.xdr.sg.paloaltonetworks.com"
API_KEY = "mYKcmCANq1jsnUcyUIOwn13wi6NqKH4QLeq46YxhvHYgvqp719dJa1kTl23yZ2WUyE7Y5AJb5HeyPdHSyL5fgFZte5a2dmFNzRBbt5J0DEfxiFiHiKdzkcwEplaGI7na"
API_KEY_ID = "11"


def get_xdr_headers():
    """Generate Cortex XDR API headers (Standard key authentication)."""
    return {
        "x-xdr-auth-id": API_KEY_ID,
        "Authorization": API_KEY,
        "Content-Type": "application/json",
    }


def format_time(epoch_ms):
    """Convert epoch ms to readable format."""
    if epoch_ms:
        return datetime.fromtimestamp(
            epoch_ms / 1000, tz=timezone.utc
        ).strftime("%Y-%m-%d %H:%M:%S UTC")
    return "N/A"


def get_latest_incidents(limit=200):
    """Fetch the latest incidents from Cortex XDR with pagination (max 100 per request)."""
    all_incidents = []
    page_size = min(limit, 100)
    offset = 0
    total_count = None

    while offset < limit:
        body = {
            "request_data": {
                "filters": [],
                "search_from": offset,
                "search_to": offset + page_size,
                "sort": {
                    "field": "creation_time",
                    "keyword": "desc",
                },
            }
        }

        response = requests.post(
            f"{XDR_API_URL}/public_api/v1/incidents/get_incidents",
            headers=get_xdr_headers(),
            json=body,
        )

        if response.status_code != 200:
            print(f"Error: HTTP {response.status_code}")
            print(response.text)
            return None

        data = response.json()
        incidents = data.get("reply", {}).get("incidents", [])
        if total_count is None:
            total_count = data.get("reply", {}).get("total_count", 0)

        all_incidents.extend(incidents)
        print(f"  Fetched page {offset // page_size + 1}: {len(incidents)} incidents (total so far: {len(all_incidents)})")

        if len(incidents) < page_size:
            break
        offset += page_size

    return {"reply": {"incidents": all_incidents[:limit], "total_count": total_count}}


def get_incident_extra_data(incident_id):
    """Fetch detailed data for a specific incident including alerts, artifacts, and network artifacts."""
    body = {
        "request_data": {
            "incident_id": str(incident_id),
            "alerts_limit": 20,
        }
    }

    response = requests.post(
        f"{XDR_API_URL}/public_api/v1/incidents/get_incident_extra_data",
        headers=get_xdr_headers(),
        json=body,
    )

    if response.status_code != 200:
        print(f"  Error fetching details for incident {incident_id}: HTTP {response.status_code}")
        return None

    return response.json()


def display_incident_detail(data):
    """Display detailed incident data."""
    if not data or "reply" not in data:
        return

    reply = data["reply"]

    # --- Incident overview ---
    inc = reply.get("incident", {})
    print(f"  Incident ID       : {inc.get('incident_id', 'N/A')}")
    print(f"  Description       : {inc.get('description', 'N/A')}")
    print(f"  Severity          : {inc.get('severity', 'N/A')}")
    print(f"  Status            : {inc.get('status', 'N/A')}")
    print(f"  Created           : {format_time(inc.get('creation_time'))}")
    print(f"  Modified          : {format_time(inc.get('modification_time'))}")
    print(f"  Assigned To       : {inc.get('assigned_user_mail') or 'Unassigned'}")
    print(f"  Alert Count       : {inc.get('alert_count', 0)}")
    print(f"  High Severity Alert Count : {inc.get('high_severity_alert_count', 0)}")
    print(f"  Hosts             : {', '.join(inc.get('hosts', [])) if inc.get('hosts') else 'N/A'}")
    print(f"  Users             : {', '.join(inc.get('users', [])) if inc.get('users') else 'N/A'}")
    print(f"  Incident Sources  : {', '.join(inc.get('incident_sources', [])) if inc.get('incident_sources') else 'N/A'}")
    print(f"  Rule Based Score  : {inc.get('rule_based_score', 'N/A')}")
    print(f"  Manual Score      : {inc.get('manual_score', 'N/A')}")
    print(f"  Starred           : {inc.get('starred', 'N/A')}")
    print(f"  XDR URL           : {inc.get('xdr_url', 'N/A')}")

    # --- Alerts ---
    alerts = reply.get("alerts", {}).get("data", [])
    if alerts:
        print(f"\n  --- Alerts ({len(alerts)}) ---")
        for i, alert in enumerate(alerts, 1):
            print(f"\n  Alert #{i}:")
            print(f"    Alert ID        : {alert.get('alert_id', 'N/A')}")
            print(f"    Name            : {alert.get('name', 'N/A')}")
            print(f"    Category        : {alert.get('category', 'N/A')}")
            print(f"    Severity        : {alert.get('severity', 'N/A')}")
            print(f"    Source          : {alert.get('source', 'N/A')}")
            print(f"    Action          : {alert.get('action', 'N/A')}")
            print(f"    Action Pretty   : {alert.get('action_pretty', 'N/A')}")
            print(f"    Detection Time  : {format_time(alert.get('detection_timestamp'))}")
            print(f"    Host Name       : {alert.get('host_name', 'N/A')}")
            print(f"    Host IP         : {alert.get('host_ip', 'N/A')}")
            print(f"    User Name       : {alert.get('user_name', 'N/A')}")
            print(f"    MITRE Tactic    : {alert.get('mitre_tactic_id_and_name', 'N/A')}")
            print(f"    MITRE Technique : {alert.get('mitre_technique_id_and_name', 'N/A')}")
            print(f"    Description     : {alert.get('description', 'N/A')}")

            # Process/event details if available
            if alert.get("action_process_image_name"):
                print(f"    Process Name    : {alert.get('action_process_image_name', 'N/A')}")
                print(f"    Process CMD     : {alert.get('action_process_image_command_line', 'N/A')}")
                print(f"    Process SHA256  : {alert.get('action_process_image_sha256', 'N/A')}")

            if alert.get("actor_process_image_name"):
                print(f"    Actor Process   : {alert.get('actor_process_image_name', 'N/A')}")
                print(f"    Actor CMD       : {alert.get('actor_process_command_line', 'N/A')}")

            if alert.get("action_external_hostname"):
                print(f"    Ext Hostname    : {alert.get('action_external_hostname', 'N/A')}")

            if alert.get("action_remote_ip"):
                print(f"    Remote IP       : {alert.get('action_remote_ip', 'N/A')}")
                print(f"    Remote Port     : {alert.get('action_remote_port', 'N/A')}")

            if alert.get("action_local_ip"):
                print(f"    Local IP        : {alert.get('action_local_ip', 'N/A')}")
                print(f"    Local Port      : {alert.get('action_local_port', 'N/A')}")

    # --- Network Artifacts ---
    net_artifacts = reply.get("network_artifacts", {}).get("data", [])
    if net_artifacts:
        print(f"\n  --- Network Artifacts ({len(net_artifacts)}) ---")
        for i, art in enumerate(net_artifacts, 1):
            print(f"    [{i}] Type: {art.get('type', 'N/A')} | "
                  f"Value: {art.get('network_remote_ip', '') or art.get('network_domain', '') or 'N/A'} | "
                  f"Country: {art.get('network_country', 'N/A')} | "
                  f"Port: {art.get('network_remote_port', 'N/A')}")

    # --- File Artifacts ---
    file_artifacts = reply.get("file_artifacts", {}).get("data", [])
    if file_artifacts:
        print(f"\n  --- File Artifacts ({len(file_artifacts)}) ---")
        for i, art in enumerate(file_artifacts, 1):
            print(f"    [{i}] Name: {art.get('file_name', 'N/A')} | "
                  f"SHA256: {art.get('file_sha256', 'N/A')} | "
                  f"Wildfire: {art.get('file_wildfire_verdict', 'N/A')} | "
                  f"Type: {art.get('type', 'N/A')}")


if __name__ == "__main__":
    LIMIT = 200

    print(f"Fetching latest {LIMIT} incidents from Cortex XDR...")
    print()
    data = get_latest_incidents(limit=LIMIT)

    if not data or "reply" not in data:
        print("No data returned.")
        exit(1)

    incidents = data["reply"].get("incidents", [])
    total = data["reply"].get("total_count", 0)
    print(f"Total incidents in XDR: {total}")
    print(f"Retrieved: {len(incidents)} incidents")

    # Export raw JSON
    with open("incidents_200_raw.json", "w") as f:
        json.dump(incidents, f, indent=2)
    print("Raw JSON saved to: incidents_200_raw.json")

    # Fetch detailed extra data for each incident
    print(f"\nFetching detailed extra data for {len(incidents)} incidents...")
    detailed_results = []

    for idx, inc in enumerate(incidents, 1):
        incident_id = inc.get("incident_id")
        print(f"  [{idx}/{len(incidents)}] Fetching details for incident {incident_id}...", end=" ")
        detail = get_incident_extra_data(incident_id)
        if detail and "reply" in detail:
            detailed_results.append(detail["reply"])
            print("OK")
        else:
            print("FAILED")

    # Export detailed JSON
    with open("incidents_200_detailed.json", "w") as f:
        json.dump(detailed_results, f, indent=2)
    print(f"\nDetailed JSON saved to: incidents_200_detailed.json")

    # --- Summary Statistics ---
    print("\n" + "=" * 100)
    print("SUMMARY STATISTICS")
    print("=" * 100)

    # Severity breakdown
    severity_counts = {}
    status_counts = {}
    description_counts = {}
    source_counts = {}
    host_set = set()

    for inc in incidents:
        sev = inc.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

        status = inc.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

        desc = inc.get("description", "unknown")
        # Extract alert name from description (text before 'generated by')
        alert_name = desc.split("generated by")[0].strip().strip("'") if "generated by" in desc else desc
        description_counts[alert_name] = description_counts.get(alert_name, 0) + 1

        for src in inc.get("incident_sources", []):
            source_counts[src] = source_counts.get(src, 0) + 1

        for host in inc.get("hosts", []):
            host_set.add(host)

    print(f"\n--- Severity Breakdown ---")
    for sev, count in sorted(severity_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {sev:<12}: {count:>5} ({count/len(incidents)*100:.1f}%)")

    print(f"\n--- Status Breakdown ---")
    for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {status:<25}: {count:>5} ({count/len(incidents)*100:.1f}%)")

    print(f"\n--- Top Alert Types ---")
    for desc, count in sorted(description_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
        print(f"  {count:>5}x  {desc}")

    print(f"\n--- Incident Sources ---")
    for src, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {src:<30}: {count:>5}")

    print(f"\n--- Unique Hosts/IPs Involved ---")
    print(f"  Total unique: {len(host_set)}")

    # Time range
    if incidents:
        oldest = format_time(incidents[-1].get("creation_time"))
        newest = format_time(incidents[0].get("creation_time"))
        print(f"\n--- Time Range ---")
        print(f"  Newest: {newest}")
        print(f"  Oldest: {oldest}")

    # --- Detailed alert analysis from extra data ---
    print("\n" + "=" * 100)
    print("DETAILED ALERT ANALYSIS (from extra data)")
    print("=" * 100)

    action_counts = {}
    mitre_tactics = {}
    mitre_techniques = {}
    category_counts = {}
    ext_hostname_counts = {}
    remote_ip_counts = {}
    net_artifact_countries = {}

    for result in detailed_results:
        alerts = result.get("alerts", {}).get("data", [])
        for alert in alerts:
            action = alert.get("action_pretty", alert.get("action", "unknown"))
            action_counts[action] = action_counts.get(action, 0) + 1

            cat = alert.get("category", "unknown")
            category_counts[cat] = category_counts.get(cat, 0) + 1

            tactic = alert.get("mitre_tactic_id_and_name")
            if tactic:
                mitre_tactics[tactic] = mitre_tactics.get(tactic, 0) + 1

            technique = alert.get("mitre_technique_id_and_name")
            if technique:
                mitre_techniques[technique] = mitre_techniques.get(technique, 0) + 1

            ext_host = alert.get("action_external_hostname")
            if ext_host:
                ext_hostname_counts[ext_host] = ext_hostname_counts.get(ext_host, 0) + 1

            remote_ip = alert.get("action_remote_ip")
            if remote_ip:
                remote_ip_counts[remote_ip] = remote_ip_counts.get(remote_ip, 0) + 1

        net_artifacts = result.get("network_artifacts", {}).get("data", [])
        for art in net_artifacts:
            country = art.get("network_country", "unknown")
            if country:
                net_artifact_countries[country] = net_artifact_countries.get(country, 0) + 1

    print(f"\n--- Alert Actions ---")
    for action, count in sorted(action_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {action:<45}: {count:>5}")

    print(f"\n--- Alert Categories ---")
    for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat:<30}: {count:>5}")

    if mitre_tactics:
        print(f"\n--- MITRE ATT&CK Tactics ---")
        for tactic, count in sorted(mitre_tactics.items(), key=lambda x: x[1], reverse=True):
            print(f"  {count:>5}x  {tactic}")
    else:
        print(f"\n--- MITRE ATT&CK Tactics ---")
        print("  None mapped")

    if mitre_techniques:
        print(f"\n--- MITRE ATT&CK Techniques ---")
        for tech, count in sorted(mitre_techniques.items(), key=lambda x: x[1], reverse=True):
            print(f"  {count:>5}x  {tech}")

    print(f"\n--- Top 20 External Hostnames (Scanner IPs) ---")
    for host, count in sorted(ext_hostname_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"  {count:>5}x  {host}")

    print(f"\n--- Top 20 Target IPs (Remote IPs) ---")
    for ip, count in sorted(remote_ip_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"  {count:>5}x  {ip}")

    print(f"\n--- Network Artifact Countries ---")
    for country, count in sorted(net_artifact_countries.items(), key=lambda x: x[1], reverse=True):
        print(f"  {country:<10}: {count:>5}")

    print(f"\nDone. Files saved:")
    print(f"  - incidents_200_raw.json      (basic incident data)")
    print(f"  - incidents_200_detailed.json  (full extra data with alerts & artifacts)")
