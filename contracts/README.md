# contracts/ — العقد + كل API (مختصر بلا حشو)

التفاصيل الكاملة للأنواع: `api.contracts.ts`. wire: `camelCase`، تواريخ ISO، مبالغ EGP أرقاماً.

| # | API | Req → Res | الفرونت `api.*` | الباك |
|---|---|---|---|---|
| 1 | `GET /health` | — → `{status,version,time}` | `api.health()` | `routes/health.ts` |
| 2 | `GET /openapi.json` | — → OpenAPI | — (مباشر) | `app.ts` |
| 3 | `POST /auth/login` | `{email,password}` → `{accessToken,refreshToken,mustChangePassword,user}` | `api.login()` | `routes/auth.ts` |
| 4 | `POST /auth/refresh` | `{refreshToken?}`/كوكي → زوج جديد | `client.ts` داخلي | `routes/auth.ts` |
| 5 | `POST /auth/logout` | `{refreshToken?}` → ok | `api.logout()` | `routes/auth.ts` |
| 6 | `POST /auth/verify-email` | `{token}` → `{email}` | `api.verifyEmail()` | `routes/auth.ts` |
| 7 | `POST /auth/resend-verification` | `{email}` → ok/`{token}` بdev | `api.resendVerification()` | `routes/auth.ts` |
| 8 | `POST /auth/change-password` | `{currentPassword?,newPassword}` → ok | `api.changePassword()` | `routes/auth.ts` |
| 9 | `POST /auth/switch-user` (ديمو) | `{userId}` → `{user}` | `api.switchUser()` | `routes/users.ts` |
| 10 | `GET /users/me` | — → `UserShape` | `api.me()` | `routes/users.ts` |
| 11 | `GET /users` | `ListUsersQuery` → `Paginated<UserShape>` | `api.listUsers/fullListUsers` | `routes/users.ts` |
| 12 | `POST /users` | `CreateOrgUserReq` → `{id}` | `api.createUser()` | `routes/users.ts` |
| 13 | `PUT /users/:id` | `UpdateOrgUserReq` → `{id}` | `api.updateUser()` | `routes/users.ts` |
| 14 | `DELETE /users/:id` | — → ok | `api.deleteUser()` | `routes/users.ts` |
| 15 | `GET /organizations` | `ListOrganizationsQuery` → `Paginated<OrganizationShape>` | `api.listOrganizations/fullListOrganizations` | `routes/users.ts` |
| 16 | `POST /organizations` | `CreateOrganizationReq` → `{id}` | `api.createOrganization()` | `routes/users.ts` |
| 17 | `PUT /organizations/:id` | `UpdateOrganizationReq` → `{id}` | `api.updateOrganization()` | `routes/users.ts` |
| 18 | `GET /initiatives` | `ListInitiativesQuery` → `Paginated<InitiativeListItem>` | `api.listInitiatives/fullListInitiatives` | `routes/initiatives.ts` |
| 19 | `GET /initiatives/:id` | — → المبادرة كاملة | `api.getInitiative()` | `routes/initiatives.ts` |
| 20 | `POST /initiatives` | `UpsertInitiativeReq` → `{id}` | `api.createInitiative()` | `routes/initiatives.ts` |
| 21 | `PUT /initiatives/:id` | `UpdateInitiativeReq` → `{id}` | `api.updateInitiative()` | `routes/initiatives.ts` |
| 22 | `DELETE /initiatives/:id` | — → ok (يرفض مع طلبات) | `api.deleteInitiative()` | `routes/initiatives.ts` |
| 23 | `GET /initiatives/:id/customization` | — → `CustomizationShape` | `store` عبر المبادرة | `routes/initiatives.ts` |
| 24 | `PUT /initiatives/:id/customization` | `UpdateCustomizationReq` (+`page?`: layout/sections/gallery/body) → المحفوظ | `api.updateCustomization()` | `routes/initiatives.ts` |
| 25 | `GET /initiatives/:id/workflow` | — → `{stages}` | `store` عبر المبادرة | `routes/initiatives.ts` |
| 26 | `PUT /initiatives/:id/workflow` | `UpdateWorkflowReq` → `{version}` | `api.updateWorkflow()` | `routes/initiatives.ts` |
| 27 | `GET /factories/mine` | — → مصنعي | `api.getMyFactory()` | `routes/factories.ts` |
| 28 | `GET /factories` | `{q,page,pageSize}` → قائمة (أدمن) | `api.listFactories/fullListFactories` | `routes/factories.ts` |
| 29 | `GET /factories/:id` | — → المصنع (مالكه/أدمن) | — عبر `getMyFactory` | `routes/factories.ts` |
| 30 | `PUT /factories/:id` | `UpdateFactoryReq` → `{id}` | `api.updateFactory()` | `routes/factories.ts` |
| 31 | `POST /factories/register` | `RegisterFactoryReq` → `{user,organization,factory,tokens?}` | `api.registerFactory()` | `routes/factories.ts` |
| 32 | `GET /factories/:id/details-files` | `?initiativeId` → `DetailsFileShape[]` | `api.listDetailsFiles()` | `routes/factories.ts` |
| 33 | `POST /factories/:id/details-files` | `multipart file=PDF` → `DetailsFileShape` | `api.uploadDetailsFile()` | `routes/factories.ts` |
| 34 | `DELETE /factories/:id/details-files/:fileId` | — → ok | `api.deleteDetailsFile()` | `routes/factories.ts` |
| 35 | `GET /applications` | `ListApplicationsQuery` (+`factoryId`) → `Paginated<ApplicationListItem>` | `api.listApplications/fullListApplications` | `routes/applications.ts` |
| 36 | `POST /applications` | `CreateApplicationReq` → `{id,applicationNumber}` | `api.createApplication()` | `routes/applications.ts` |
| 37 | `GET /applications/:id` | — → التفاصيل + `detailsFiles` | `store`/`api` التفاصيل | `routes/applications.ts` |
| 38 | `POST /applications/:id/decisions` | `CreateDecisionReq` → `{newStatus,newStageId}` | `api.createDecision()` | `routes/applications.ts` |
| 39 | `GET /applications/:id/messages` | `?page&pageSize` → `MessageShape[]` | `api.listMessages()` | `routes/messages.ts` |
| 40 | `POST /applications/:id/messages` | `SendMessageReq{toOrgId,body,customFields?,detailsFileId?}` → `MessageShape` | `api.sendMessage()` | `routes/messages.ts` |
| 41 | `GET /dashboard/summary` | — → `{totalApps,approvedApps,inReviewApps,reworkApps,slaCompliance}` | `api.dashboardSummary()` | `routes/system.ts` |
| 42 | `GET /reports/applications.csv` | فلاتر القائمة → CSV | رابط مباشر بتوكن | `routes/system.ts` |
| 43 | `GET /reports/initiatives.csv` | — → CSV | رابط مباشر بتوكن | `routes/system.ts` |
| 44 | `GET /audit-logs` | `?page&pageSize` → `Paginated<AuditShape>` | `api.listAuditLogs()` | `routes/system.ts` |

الأخطاء موحدة `ApiError{code,messageAr,messageEn,details?}` — راجع `api.contracts.ts` وأمثلة `docs/API_CONTRACTS.md`.
