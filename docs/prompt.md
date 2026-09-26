You are a senior software architect, product designer, UX/UI designer, backend engineer, frontend engineer, database architect, DevOps engineer, and QA engineer working as one coordinated product team.

Your task is to DESIGN AND BUILD a production-ready, scalable web platform for the Egyptian Ministry of Industry to manage industrial initiatives from end to end.

IMPORTANT:
This is NOT a platform for one specific initiative.
It must be a GENERIC INDUSTRIAL INITIATIVES MANAGEMENT PLATFORM where administrators can create, configure, launch, operate, monitor, and close different industrial initiatives without changing the source code.

The Solar Energy Initiative shown in the provided reference image is ONLY an example of one initiative and should be modeled as a configurable workflow/template.

==================================================
1. CORE PRODUCT VISION
==================================================

Build a centralized platform that allows the Ministry of Industry to manage multiple industrial initiatives.

The platform should support the complete lifecycle:

Initiative
→ Factory Registration
→ Application
→ Eligibility Review
→ Document Verification
→ Technical/Financial Evaluation
→ Approval
→ Assignment to responsible entities
→ Execution
→ Inspection
→ Final Approval
→ Completion
→ Monitoring
→ Reporting

The most important concept is:

INITIATIVE = CONFIGURATION
WORKFLOW = DYNAMIC ENGINE
APPLICATION = WORKFLOW INSTANCE
ORGANIZATION = RESPONSIBLE ENTITY
USER = ACTOR
ROLE/PERMISSION = ACCESS CONTROL

Do NOT hard-code the workflow of the Solar Energy initiative.

The administrator must be able to create completely different initiatives through the Admin Dashboard.

==================================================
2. MAIN USERS
==================================================

The system should support multiple user types:

1. Ministry Super Admin
2. Ministry Administrator
3. Initiative Manager
4. Organization Administrator
5. Organization Reviewer
6. Organization Approver
7. Bank User
8. Technical Service Provider
9. Electricity/Utility Organization User
10. Factory Owner / Factory Representative
11. Read-only / Reporting User

The architecture must allow adding new roles later.

==================================================
3. ORGANIZATION MANAGEMENT
==================================================

The Admin must be able to dynamically create and manage participating organizations.

Examples:

- Ministry of Industry
- Industrial Development Authority
- Industrial Modernization Center
- Banks
- Electricity Distribution Companies
- Renewable Energy Companies
- Technical Service Providers
- Other government entities
- Private sector entities

Admin capabilities:

- Create organization
- Edit organization
- Activate/deactivate organization
- Assign organization type
- Add organization departments
- Create organization accounts
- Assign roles
- Assign permissions
- Assign users to initiatives
- Assign users to workflow stages
- View organization activity
- View organization workload
- Control what each organization can see

Do NOT assume that organizations are fixed in the code.

==================================================
4. FACTORY MANAGEMENT
==================================================

Create a centralized Factory Profile.

A factory should register once and maintain its profile.

Factory data may include:

- Factory name
- Legal entity
- Industrial registration
- Commercial registration
- Tax information
- Industrial activity
- Industrial sector
- Factory location
- Governorate
- Contact information
- Authorized representative
- Production information
- Energy information
- Financial information where applicable
- Licenses
- Certificates
- Documents

When a factory applies for another initiative:

DO NOT force the factory to enter all information again.

Reuse the existing Factory Profile and ask only for initiative-specific information.

==================================================
5. INITIATIVE MANAGEMENT
==================================================

Create an Admin module called:

INITIATIVE MANAGEMENT

Admin can:

- Create initiative
- Edit initiative
- Publish initiative
- Unpublish initiative
- Activate/deactivate initiative
- Archive initiative
- Duplicate initiative
- Create initiative from template
- Set application start date
- Set application end date
- Define eligibility criteria
- Define target industrial sectors
- Define required documents
- Define application form
- Define responsible organizations
- Define workflow
- Define SLA
- Define notifications
- Define visibility rules
- Define approval rules
- Define reporting fields

Every initiative should have:

- Name
- Arabic name
- English name
- Description
- Objectives
- Eligibility
- Required documents
- Participating organizations
- Workflow
- Application form
- Status
- Dates
- KPIs

==================================================
6. DYNAMIC APPLICATION FORM BUILDER
==================================================

The Admin should NOT need a developer to create forms.

Create a configurable form builder.

Supported fields:

- Text
- Number
- Email
- Phone
- Date
- Dropdown
- Multi-select
- Radio
- Checkbox
- File upload
- Long text
- Address
- Governorate
- Industrial sector
- Table/repeating fields

Admin can configure:

- Required/optional
- Validation
- Minimum/maximum
- Visibility conditions
- Field permissions
- Default values
- Help text
- Arabic/English labels

Support conditional fields.

Example:

IF factory selected "Solar Energy"
THEN show energy consumption fields.

==================================================
7. DYNAMIC WORKFLOW BUILDER
==================================================

THIS IS THE MOST IMPORTANT MODULE.

Build a visual workflow builder.

The Admin should be able to create:

- Stages
- Tasks
- Approvals
- Reviews
- Rejections
- Document verification
- Assignments
- Inspections
- Payments
- External approvals
- Completion steps

Example:

Factory Registration
↓
Eligibility Review
↓
Technical Study
↓
Financing
↓
Contracting
↓
Installation
↓
Inspection
↓
Grid Connection
↓
Commercial Operation
↓
Completed

But this is only an example.

The Admin must be able to change it.

Allow:

- Add stage
- Delete stage
- Rename stage
- Reorder stage
- Connect stages
- Create branching
- Create conditional transitions
- Assign organization
- Assign role
- Assign specific user
- Set SLA
- Set required documents
- Set required fields
- Set approval conditions
- Set rejection behavior
- Set return-for-correction behavior

Example:

Technical Review
      ↓
   Approved
      ↓
Financing

Technical Review
      ↓
   Rejected
      ↓
Application Rejected

Technical Review
      ↓
Need Modification
      ↓
Factory Corrects Application
      ↓
Technical Review Again

The workflow engine must be generic and reusable.

==================================================
8. WORKFLOW ENGINE
==================================================

Implement the workflow as a real engine, not frontend-only logic.

Each application creates a workflow instance.

Track:

- Current stage
- Current status
- Assigned organization
- Assigned user
- Pending action
- Due date
- SLA
- Previous stages
- Decisions
- Comments
- Documents
- Timestamps

Possible statuses:

- Draft
- Submitted
- Under Review
- Pending Information
- Pending Approval
- Approved
- Rejected
- Returned
- In Progress
- Completed
- Cancelled
- Suspended

==================================================
9. APPROVAL SYSTEM
==================================================

Approval must be more than a simple button.

Every approval should record:

- User
- Organization
- Role
- Date/time
- Decision
- Comments
- Previous status
- New status
- Related documents

Actions:

- Approve
- Reject
- Request Modification
- Request Document
- Return to Previous Stage
- Escalate

Every action must generate an audit record.

==================================================
10. ROLE-BASED AND SCOPE-BASED ACCESS CONTROL
==================================================

Implement strong RBAC.

But do NOT rely only on roles.

Support:

ROLE + ORGANIZATION + INITIATIVE + WORKFLOW STAGE + DATA SCOPE

Example:

Ministry Admin:
Can see everything.

IMC Reviewer:
Can see applications assigned to IMC.

Bank:
Can see only applications assigned to that bank.

Solar Company:
Can see only factories/projects assigned to that company.

Factory:
Can see only its own profile and applications.

The system should support field-level visibility where necessary.

For example:

Financial data may be visible to the bank but hidden from a technical service provider.

==================================================
11. DOCUMENT MANAGEMENT
==================================================

Create a proper document management module.

Support:

- Upload
- Download
- Preview
- Document type
- Required documents
- Document status
- Verification
- Rejection reason
- Versioning
- Upload date
- Uploaded by
- Verified by

Example:

Commercial Registration
Industrial License
Technical Study
Financial Study
Contract
Inspection Report
Grid Connection Certificate

Documents must be linked to factories, initiatives, applications, and workflow stages.

==================================================
12. NOTIFICATION SYSTEM
==================================================

Create a centralized notification engine.

Notifications should be triggered by events:

- Application submitted
- Application approved
- Application rejected
- Document requested
- Stage changed
- Task assigned
- SLA approaching
- SLA exceeded
- Application completed

Start with:

- In-app notifications
- Email-ready architecture

Design the system so SMS/WhatsApp can be added later.

==================================================
13. FACTORY PORTAL
==================================================

The factory should have a simple dashboard.

Show:

- Factory profile
- Available initiatives
- My applications
- Application status
- Current stage
- Required actions
- Missing documents
- Notifications
- History

Example:

Solar Energy Initiative

Registration        ✓
Eligibility         ✓
Technical Review    ✓
Financing           ●
Installation        ○
Inspection          ○
Operation           ○

Current Status:
Pending Bank Approval

Keep this extremely clear and user-friendly.

==================================================
14. ADMIN DASHBOARD
==================================================

Create a professional Ministry dashboard.

Show:

- Total initiatives
- Active initiatives
- Total factories
- Total applications
- Pending applications
- Approved applications
- Rejected applications
- Completed applications
- Applications by initiative
- Applications by governorate
- Applications by industrial sector
- Applications by organization
- Average processing time
- SLA violations
- Bottlenecks
- Current workload

Include useful charts but DO NOT overcomplicate the dashboard.

Prioritize useful operational information.

==================================================
15. APPLICATION MANAGEMENT
==================================================

Create an advanced application table.

Columns can include:

- Application ID
- Factory
- Initiative
- Sector
- Governorate
- Current Stage
- Status
- Assigned Organization
- Assigned User
- Submitted Date
- SLA
- Last Action
- Completion %

Support:

- Search
- Filtering
- Sorting
- Pagination
- Export
- Bulk actions where safe
- Saved filters

Admin should be able to open an application and see its complete timeline.

==================================================
16. APPLICATION TIMELINE
==================================================

Every application needs a visual timeline.

Example:

04 Sep
Application Submitted
Factory

05 Sep
Eligibility Approved
IDA

07 Sep
Technical Review Approved
IMC

08 Sep
Sent to Bank
System

09 Sep
Financing Under Review
Bank

The timeline should show:

WHO
WHAT
WHEN
WHY
WHAT CHANGED

==================================================
17. AUDIT LOG
==================================================

Create a complete audit trail.

Track every sensitive operation:

- Login
- Create
- Update
- Delete
- Approval
- Rejection
- Assignment
- Document upload
- Document verification
- Workflow transition
- Permission change

The system must make it difficult to manipulate historical workflow actions.

==================================================
18. REPORTING & EXPORT
==================================================

Admin must be able to export data to Excel.

Support reports such as:

- All factories
- Applications
- Applications by initiative
- Applications by status
- Applications by organization
- Applications by governorate
- Completed projects
- Pending applications
- SLA violations
- Processing times

Export must respect permissions.

Users should NEVER be able to export data they are not authorized to view.

==================================================
19. INITIATIVE ANALYTICS
==================================================

Each initiative gets its own dashboard.

Example:

Solar Energy Initiative

Applications: 1,250
Approved: 820
Rejected: 120
In Progress: 210
Completed: 100

Average Processing Time:
18 days

SLA Compliance:
92%

Add useful operational metrics.

==================================================
20. SLA MANAGEMENT
==================================================

Every workflow stage can have an SLA.

Example:

Eligibility Review:
3 working days

Technical Review:
5 working days

Bank Review:
7 working days

Track:

- Time spent
- Due date
- Remaining time
- Overdue
- Escalation

Show overdue tasks clearly to administrators.

==================================================
21. SEARCH
==================================================

Create global search.

Search by:

- Factory name
- Application ID
- Industrial registration
- Initiative
- Organization
- Status
- Sector
- Governorate

Make search fast and scalable.

==================================================
22. BILINGUAL SYSTEM
==================================================

The platform must support:

Arabic
English

Arabic is the primary language.

The entire interface must support RTL properly.

Do not create a fake RTL by simply flipping the layout.

Design both directions properly.

==================================================
23. EGYPTIAN GOVERNMENT / INDUSTRIAL VISUAL IDENTITY
==================================================

The visual identity must feel appropriate for:

- Egyptian Ministry of Industry
- Government platform
- Industrial modernization
- National development
- Sustainability
- Digital transformation

Use visual inspiration from:

- Egyptian identity
- Egyptian flag
- Industrial architecture
- Manufacturing
- Engineering
- Renewable energy
- Modern government digital services

Use Egyptian flag colors carefully as accent colors rather than making the whole interface look like a flag.

Preferred visual direction:

- Professional
- Modern
- Institutional
- Clean
- Trustworthy
- Premium
- Accessible
- Highly readable

Avoid:

- Excessive gradients
- Cyberpunk
- Gaming UI
- Excessive glassmorphism
- Neon colors
- Overly futuristic interfaces
- Unnecessary animations

The platform should look like a serious national digital infrastructure.

IMPORTANT:
Do NOT invent or fake an official government logo.
If official branding assets are available, use them appropriately.
Otherwise create a neutral institutional visual system inspired by Egyptian industrial identity without pretending it is an official ministry logo.

==================================================
24. UX PRINCIPLES
==================================================

The platform must be practical.

A government employee should understand what to do without training.

Prioritize:

- Clear navigation
- Clear status
- Clear actions
- Clear permissions
- Clear responsibilities
- Minimal clicks
- Strong search
- Good tables
- Useful dashboards
- Excellent forms
- Responsive design

Do not add features simply because they look impressive.

Every feature must have an operational purpose.

==================================================
25. RESPONSIVE DESIGN
==================================================

The platform must work on:

- Desktop
- Laptop
- Tablet
- Mobile

The Admin Dashboard can be desktop-first, but must remain usable on smaller screens.

==================================================
26. SECURITY
==================================================

Treat this as a government-grade business application.

Implement architecture for:

- Secure authentication
- Password hashing
- Session management
- Role-based access
- Organization-level access
- Data-level access
- Input validation
- File validation
- Secure uploads
- Rate limiting
- CSRF/XSS/SQL injection protection
- Secure API design
- Audit logs
- Permission checks on backend
- No sensitive authorization logic only on frontend

Never trust frontend permissions.

==================================================
27. DATABASE
==================================================

Use a relational database.

Preferred:

PostgreSQL

Design normalized relational structures for:

- Users
- Organizations
- Roles
- Permissions
- Factories
- Factory Documents
- Initiatives
- Initiative Forms
- Initiative Fields
- Workflow Definitions
- Workflow Stages
- Workflow Transitions
- Workflow Instances
- Workflow Tasks
- Applications
- Application Data
- Documents
- Approvals
- Comments
- Notifications
- Audit Logs

The database must support future growth.

Do not create an unnecessarily complicated database.

==================================================
28. BACKEND
==================================================

Use a maintainable Node.js backend.

Preferred:

Node.js
TypeScript
NestJS or a well-structured Express architecture

Use modular architecture.

Suggested modules:

auth
users
organizations
roles
permissions
factories
initiatives
forms
workflows
applications
documents
notifications
reports
audit
analytics

Build reusable services.

==================================================
29. FRONTEND
==================================================

Preferred:

Next.js
TypeScript
Modern React architecture

Use a reusable component system.

Create reusable:

- Data tables
- Forms
- Status badges
- Workflow components
- Timeline
- Approval dialogs
- Document components
- Dashboard cards
- Filters
- Modal dialogs
- Navigation
- Charts

Do not duplicate UI logic.

==================================================
30. DEVELOPMENT STRATEGY — WORK IN PARALLEL
==================================================

IMPORTANT:

Work as a coordinated multi-disciplinary team.

Divide the project into independent workstreams that can be developed in parallel.

WORKSTREAM A — PRODUCT & UX

Responsible for:

- User journeys
- Information architecture
- Navigation
- Factory journey
- Admin journey
- Organization journey
- Workflow UX
- Application timeline
- UX states

WORKSTREAM B — DESIGN SYSTEM

Responsible for:

- Egyptian industrial visual identity
- Color system
- Typography
- RTL
- Components
- Layout
- Responsive behavior
- Accessibility

WORKSTREAM C — DATABASE

Responsible for:

- ERD
- Database schema
- Relationships
- Indexes
- Constraints
- Migration strategy

WORKSTREAM D — AUTH & RBAC

Responsible for:

- Authentication
- Users
- Organizations
- Roles
- Permissions
- Data scopes
- Field visibility

WORKSTREAM E — INITIATIVE ENGINE

Responsible for:

- Initiative CRUD
- Initiative templates
- Initiative configuration
- Publishing
- Lifecycle

WORKSTREAM F — FORM ENGINE

Responsible for:

- Dynamic forms
- Form fields
- Validation
- Conditional fields
- Form versions

WORKSTREAM G — WORKFLOW ENGINE

Responsible for:

- Workflow definitions
- Stages
- Transitions
- Conditions
- Tasks
- Approvals
- Rejection
- Rework
- SLA

WORKSTREAM H — FACTORY & APPLICATIONS

Responsible for:

- Factory profile
- Applications
- Application lifecycle
- Factory dashboard
- Application timeline

WORKSTREAM I — DOCUMENT MANAGEMENT

Responsible for:

- Upload
- Verification
- Versioning
- Permissions
- Document lifecycle

WORKSTREAM J — NOTIFICATIONS

Responsible for:

- Event-driven notifications
- In-app notifications
- Email architecture

WORKSTREAM K — REPORTING & ANALYTICS

Responsible for:

- Dashboards
- KPIs
- Reports
- Excel export
- SLA reports

WORKSTREAM L — QA & SECURITY

Responsible for:

- Unit tests
- Integration tests
- E2E tests
- Permission tests
- Workflow tests
- Security validation
- Edge cases

==================================================
31. PARALLEL DEVELOPMENT RULES
==================================================

Each workstream should work independently where possible.

Before implementing a module:

1. Define its interfaces.
2. Define its database dependencies.
3. Define its API contracts.
4. Define its required UI contracts.
5. Keep contracts stable.
6. Avoid modifying another workstream unnecessarily.

If a dependency is not ready:

DO NOT STOP THE ENTIRE PROJECT.

Create a clean interface/mock implementation and continue.

Integrate everything after the contracts are stable.

==================================================
32. API-FIRST ARCHITECTURE
==================================================

All important operations must be represented through backend APIs.

Do not make the system dependent on frontend-only state.

Design clear APIs for:

- Authentication
- Factories
- Initiatives
- Applications
- Workflows
- Tasks
- Approvals
- Organizations
- Users
- Documents
- Notifications
- Reports

Use consistent:

- HTTP status codes
- Error structure
- Validation
- Pagination
- Filtering
- Authorization

==================================================
33. SOLAR ENERGY INITIATIVE DEMO
==================================================

Use the provided reference image as the initial demo initiative.

Model its workflow approximately as:

Stage 1:
Factory Registration & Eligibility

Stage 2:
Study & Evaluation

Stage 3:
Financing Structure

Stage 4:
Contracting & Implementation

Stage 5:
Inspection & Commissioning

Stage 6:
Grid Operation & Monitoring

Example flow:

Factory Registration
↓
Eligibility Check
↓
Technical/Financial Study
↓
Financing Approval
↓
Contract
↓
Installation
↓
Inspection
↓
Grid Connection
↓
Commercial Operation
↓
Monitoring

This must be implemented USING THE DYNAMIC WORKFLOW ENGINE.

Do not hard-code it.

==================================================
34. ADMIN WORKFLOW BUILDER UX
==================================================

Create an intuitive visual editor.

Example:

┌────────────────────┐
│ Factory Registration│
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Eligibility Review │
└─────────┬──────────┘
          ↓
      ┌───┴───┐
      ↓       ↓
   Approve   Reject
      ↓
Technical Review
      ↓
Bank Approval
      ↓
Installation
      ↓
Inspection
      ↓
Completed

Admin can click any node and configure it.

==================================================
35. NO UNNECESSARY AI
==================================================

Do NOT add AI simply for marketing.

This platform does not need generative AI to be valuable.

Focus on:

- Workflow
- Data
- Permissions
- Automation
- Reporting
- Reliability
- Usability
- Scalability

AI can be added later for optional features such as document classification or analytics, but it must NOT be a dependency of the core platform.

==================================================
36. NO OVERENGINEERING
==================================================

Do NOT start with:

- Microservices everywhere
- Kubernetes
- Complex event infrastructure
- AI agents
- Blockchain
- Unnecessary distributed systems

Start with a well-structured modular monolith.

It should be possible to scale individual components later.

Prefer:

Simple
Reliable
Maintainable
Testable
Scalable

==================================================
37. PERFORMANCE
==================================================

Design for potentially:

- Thousands of factories
- Thousands of applications
- Many concurrent users
- Many organizations
- Multiple initiatives
- Large document volumes

Use:

- Pagination
- Database indexing
- Efficient queries
- Caching where useful
- Background jobs for heavy tasks
- Object storage for files
- Proper database constraints

Do not load huge datasets into the browser.

==================================================
38. AUDITABILITY
==================================================

Every workflow decision must be explainable.

At any point an administrator should be able to answer:

Who submitted this?
Who reviewed it?
Who approved it?
When?
What documents were used?
What changed?
Why was it rejected?
Who currently owns the task?
How long has it been waiting?
What happens next?

==================================================
39. ERROR & EDGE CASE HANDLING
==================================================

Handle:

- Duplicate factory registration
- Duplicate applications
- Missing documents
- Invalid documents
- Rejected applications
- Returned applications
- User deactivation
- Organization deactivation
- Workflow changes after applications already started
- Expired initiatives
- SLA violations
- Unauthorized access
- Failed notifications
- Upload failures

IMPORTANT:
Existing workflow instances must not break simply because an administrator later edits the workflow definition.

Use workflow versioning.

==================================================
40. WORKFLOW VERSIONING
==================================================

Initiatives and workflows must support versions.

Example:

Solar Initiative v1
Solar Initiative v2

Applications already running on v1 should continue on v1.

New applications use v2.

This is critical.

==================================================
41. SEED DATA
==================================================

Create demo data:

Organizations:
- Ministry
- IDA
- IMC
- Bank
- Solar Company
- Electricity Company

Users:
- Admin
- IMC Reviewer
- Bank Reviewer
- Factory User

Initiative:
Solar Energy Initiative

Factories:
Create several realistic demo factories.

Applications:
Create applications in different workflow stages.

This should make the platform immediately demonstrable.

==================================================
42. FINAL DELIVERABLE
==================================================

Build a complete functional MVP, not a static mockup.

The MVP must allow:

1. Admin login
2. Create organizations
3. Create organization users
4. Create roles
5. Create initiatives
6. Configure initiative
7. Create dynamic application form
8. Build workflow
9. Publish initiative
10. Factory registration
11. Factory application
12. Application review
13. Approval/rejection
14. Assignment to organizations
15. Document upload
16. Application tracking
17. Notifications
18. Audit trail
19. Admin dashboard
20. Organization dashboard
21. Factory dashboard
22. Reports
23. Excel export
24. Arabic/English
25. Responsive UI

==================================================
43. DEVELOPMENT PROCESS
==================================================

Before coding:

1. Analyze the complete requirements.
2. Identify ambiguities.
3. Create system architecture.
4. Create database ERD.
5. Create module boundaries.
6. Create API contracts.
7. Create UX architecture.
8. Define design system.
9. Define workflow data model.
10. Create implementation roadmap.

Then implement in parallel workstreams.

After each major module:

- Run tests.
- Validate integration.
- Check authorization.
- Check RTL.
- Check responsive behavior.
- Check database integrity.
- Check edge cases.

Do NOT stop after generating screens.

The result must be functional.

==================================================
44. QUALITY BAR
==================================================

The final product should feel like:

A serious national industrial digital platform.

NOT:

A startup landing page.
NOT:
A dashboard template.
NOT:
A flashy AI demo.
NOT:
A simple CRUD application.

It should feel operational, trustworthy, scalable, and easy for government employees and factories to use.

==================================================
45. FINAL PRINCIPLE
==================================================

When making design or engineering decisions, always prioritize:

1. Operational usefulness
2. Simplicity
3. Security
4. Auditability
5. Scalability
6. Maintainability
7. Accessibility
8. Performance
9. Government-grade UX
10. Future extensibility

Build the platform around the idea that tomorrow the Ministry may introduce 10, 50, or 100 different industrial initiatives.

The system should handle this WITHOUT requiring developers to rebuild the application for every new initiative.