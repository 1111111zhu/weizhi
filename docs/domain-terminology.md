# Project Wing Domain Terminology

Project Wing uses different business objects for commercial acceptance and engagement execution. User-facing copy must preserve this distinction.

| System | Code object | English | Chinese | Code label |
| --- | --- | --- | --- | --- |
| CMP | `CmpClient` | Client | 客户 | Client Code / 客户代码 |
| CMP | `CmpEngagement` | Engagement | 业务 | Engagement Code / 业务代码 |
| EMP | `Project` | Project | 项目 | Project Code / 项目代码 |
| TMS | `TmsProjectLink` | EMP Project link | EMP 项目关联 | EMP Project Code / EMP 项目代码 |

## Relationship

One CMP Engagement may be executed through more than one EMP Project. Each TMS chargeable row selects one EMP Project and derives its owning CMP Engagement for budget, approval, and cost roll-up.

```text
CMP Client
└─ CMP Engagement (business and commercial unit)
   ├─ EMP Project (execution workspace)
   └─ EMP Project (execution workspace)
```

## Copy rules

- Do not translate CMP Engagement as “项目”. Use “业务”.
- Use “承接业务” only when the acceptance context needs to be explicit.
- Reserve “项目” for EMP Project and its execution workspace.
- TMS selection controls choose an EMP Project. The CMP business code is supporting roll-up context, not the selected object.
- Internal database and API identifiers remain `CmpEngagement` and `engagementCode`; this terminology decision does not require a destructive rename.
