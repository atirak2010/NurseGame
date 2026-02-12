---
name: palo-alto-security
description: "Palo Alto Networks security platform covering Prisma Cloud (CSPM/CWPP), Cortex XDR, Cortex XSOAR, and Prisma Access. Use when working with Palo Alto APIs, RQL queries, XSOAR playbooks, XDR incident response, cloud security posture, or integrating Palo Alto tools."
---

# Palo Alto Networks Security Platform

## Overview

Palo Alto comprehensive security platform for cloud, endpoint, and network security.

## Products

| Product | Purpose | API |
|---------|---------|-----|
| Prisma Cloud | CSPM, CWPP, Code Security | Prisma Cloud API |
| Cortex XDR | Extended Detection & Response | XDR API |
| Cortex XSOAR | Security Orchestration | XSOAR API |
| Prisma Access | SASE/Zero Trust | Prisma Access API |

## Prisma Cloud

### Authentication

```python
import requests

def get_prisma_token(api_url: str, access_key: str, secret_key: str) -> str:
    """Authenticate to Prisma Cloud."""
    response = requests.post(
        f"{api_url}/login",
        json={"username": access_key, "password": secret_key}
    )
    return response.json()["token"]

def prisma_headers(token: str) -> dict:
    return {"x-redlock-auth": token, "Content-Type": "application/json"}

# API URLs by region
PRISMA_URLS = {
    "us-1": "https://api.prismacloud.io",
    "us-2": "https://api2.prismacloud.io",
    "eu": "https://api.eu.prismacloud.io",
    "gov": "https://api.gov.prismacloud.io"
}
```

### RQL Queries (Resource Query Language)

```python
def run_rql_query(api_url: str, token: str, query: str, 
                  time_range: dict = None) -> dict:
    """Execute RQL config or event query."""
    body = {"query": query}
    if time_range:
        body["timeRange"] = time_range  # {"type": "relative", "value": {"amount": 24, "unit": "hour"}}
    
    return requests.post(
        f"{api_url}/search/config",
        headers=prisma_headers(token),
        json=body
    ).json()

# Common RQL queries
PUBLIC_S3 = "config from cloud.resource where cloud.type = 'aws' AND api.name = 'aws-s3api-get-bucket-acl' AND json.rule = acl.grants[*].permission contains 'READ'"

UNENCRYPTED_EBS = "config from cloud.resource where cloud.type = 'aws' AND api.name = 'aws-ec2-describe-volumes' AND json.rule = encrypted is false"

OPEN_SECURITY_GROUPS = "config from cloud.resource where cloud.type = 'aws' AND api.name = 'aws-ec2-describe-security-groups' AND json.rule = ipPermissions[*].ipRanges[*] contains '0.0.0.0/0'"

IAM_OVERPRIVILEGED = "config from cloud.resource where cloud.type = 'aws' AND api.name = 'aws-iam-get-policy-version' AND json.rule = document.Statement[*].Effect equals Allow and document.Statement[*].Action equals '*'"

# Network query
INTERNET_EXPOSED = "config from network where source.network = UNTRUST_INTERNET and dest.resource.type = 'Instance' and dest.cloud.type = 'AWS'"
```

### Alerts & Policies

```python
def get_alerts(api_url: str, token: str, status: str = "open",
               severity: str = None, limit: int = 100) -> list:
    """Get Prisma Cloud alerts."""
    body = {
        "filters": [{"name": "alert.status", "value": status}],
        "limit": limit
    }
    if severity:
        body["filters"].append({"name": "policy.severity", "value": severity})
    
    return requests.post(
        f"{api_url}/v2/alert",
        headers=prisma_headers(token),
        json=body
    ).json()

def dismiss_alert(api_url: str, token: str, alert_ids: list,
                  dismissal_note: str, reason: str = "REASON_ACCEPTED_RISK") -> dict:
    """Dismiss alerts."""
    return requests.post(
        f"{api_url}/alert/dismiss",
        headers=prisma_headers(token),
        json={
            "alerts": alert_ids,
            "dismissalNote": dismissal_note,
            "dismissalTimeRange": {"type": "relative", "value": {"amount": 30, "unit": "day"}},
            "filter": {"reasons": [reason]}
        }
    ).json()

def get_policies(api_url: str, token: str, enabled: bool = True) -> list:
    """Get security policies."""
    params = {"policy.enabled": str(enabled).lower()}
    return requests.get(
        f"{api_url}/v2/policy",
        headers=prisma_headers(token),
        params=params
    ).json()
```

### Vulnerability Management

```python
def get_vulnerabilities(api_url: str, token: str, severity: str = None,
                        cve_id: str = None) -> list:
    """Get vulnerability findings from Prisma Cloud Compute."""
    params = {}
    if severity:
        params["severity"] = severity
    if cve_id:
        params["cveID"] = cve_id
    
    return requests.get(
        f"{api_url}/api/v1/vulnerabilities",
        headers=prisma_headers(token),
        params=params
    ).json()

def get_container_images_vulns(api_url: str, token: str) -> list:
    """Get container image vulnerabilities."""
    return requests.get(
        f"{api_url}/api/v1/images",
        headers=prisma_headers(token)
    ).json()
```

## Cortex XDR

### Authentication

```python
import hashlib
import secrets
from datetime import datetime, timezone

def get_xdr_headers(api_key: str, api_key_id: str) -> dict:
    """Generate Cortex XDR API headers with authentication."""
    nonce = secrets.token_hex(32)
    timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    auth_string = f"{api_key}{nonce}{timestamp}"
    auth_hash = hashlib.sha256(auth_string.encode()).hexdigest()
    
    return {
        "x-xdr-auth-id": api_key_id,
        "x-xdr-nonce": nonce,
        "x-xdr-timestamp": timestamp,
        "Authorization": auth_hash,
        "Content-Type": "application/json"
    }
```

### Incidents & Alerts

```python
XDR_URL = "https://api-{tenant}.xdr.us.paloaltonetworks.com"  # Adjust region

def get_xdr_incidents(tenant: str, api_key: str, api_key_id: str,
                      status: str = None, limit: int = 100) -> list:
    """Get XDR incidents."""
    body = {
        "request_data": {
            "filters": [],
            "search_from": 0,
            "search_to": limit
        }
    }
    if status:
        body["request_data"]["filters"].append({
            "field": "status",
            "operator": "eq",
            "value": status  # new, under_investigation, resolved_*
        })
    
    return requests.post(
        f"{XDR_URL.format(tenant=tenant)}/public_api/v1/incidents/get_incidents",
        headers=get_xdr_headers(api_key, api_key_id),
        json=body
    ).json()

def get_xdr_alerts(tenant: str, api_key: str, api_key_id: str,
                   severity: str = None) -> list:
    """Get XDR alerts."""
    body = {"request_data": {"filters": []}}
    if severity:
        body["request_data"]["filters"].append({
            "field": "severity",
            "operator": "eq",
            "value": severity  # low, medium, high, critical
        })
    
    return requests.post(
        f"{XDR_URL.format(tenant=tenant)}/public_api/v1/alerts/get_alerts",
        headers=get_xdr_headers(api_key, api_key_id),
        json=body
    ).json()
```

### Endpoint Management

```python
def get_endpoints(tenant: str, api_key: str, api_key_id: str) -> list:
    """Get managed endpoints."""
    return requests.post(
        f"{XDR_URL.format(tenant=tenant)}/public_api/v1/endpoints/get_endpoints",
        headers=get_xdr_headers(api_key, api_key_id),
        json={"request_data": {}}
    ).json()

def isolate_endpoint(tenant: str, api_key: str, api_key_id: str,
                     endpoint_id: str) -> dict:
    """Isolate endpoint from network."""
    return requests.post(
        f"{XDR_URL.format(tenant=tenant)}/public_api/v1/endpoints/isolate",
        headers=get_xdr_headers(api_key, api_key_id),
        json={"request_data": {"endpoint_id": endpoint_id}}
    ).json()

def scan_endpoint(tenant: str, api_key: str, api_key_id: str,
                  endpoint_id: str) -> dict:
    """Initiate endpoint scan."""
    return requests.post(
        f"{XDR_URL.format(tenant=tenant)}/public_api/v1/endpoints/scan",
        headers=get_xdr_headers(api_key, api_key_id),
        json={"request_data": {"endpoint_id_list": [endpoint_id]}}
    ).json()
```

## Cortex XSOAR

### Incidents

```python
XSOAR_URL = "https://your-xsoar-instance.com"

def xsoar_headers(api_key: str) -> dict:
    return {"Authorization": api_key, "Content-Type": "application/json"}

def create_xsoar_incident(api_key: str, name: str, incident_type: str,
                          severity: int, details: dict = None) -> dict:
    """Create XSOAR incident."""
    body = {
        "name": name,
        "type": incident_type,
        "severity": severity,  # 0=Unknown, 1=Low, 2=Medium, 3=High, 4=Critical
        "createInvestigation": True
    }
    if details:
        body["customFields"] = details
    
    return requests.post(
        f"{XSOAR_URL}/incident",
        headers=xsoar_headers(api_key),
        json=body
    ).json()

def run_playbook(api_key: str, incident_id: str, playbook_id: str) -> dict:
    """Run playbook on incident."""
    return requests.post(
        f"{XSOAR_URL}/incident/playbook",
        headers=xsoar_headers(api_key),
        json={"incidentId": incident_id, "playbookId": playbook_id}
    ).json()
```

### Integrations

```python
def get_integration_instances(api_key: str) -> list:
    """List configured integrations."""
    return requests.post(
        f"{XSOAR_URL}/settings/integration/search",
        headers=xsoar_headers(api_key),
        json={}
    ).json()

def run_command(api_key: str, command: str, args: dict = None,
                investigation_id: str = None) -> dict:
    """Execute integration command."""
    body = {"commands": command}
    if args:
        body["args"] = args
    if investigation_id:
        body["investigationId"] = investigation_id
    
    return requests.post(
        f"{XSOAR_URL}/entry",
        headers=xsoar_headers(api_key),
        json=body
    ).json()
```
