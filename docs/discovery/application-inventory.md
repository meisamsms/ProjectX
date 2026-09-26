# SevenRooms application inventory — discovery checkpoint

Status: **IN PROGRESS**. Observations are from the authorized Ocean’s at Arthur’s manager UI on 2026-09-26. This document describes visible functionality only. It contains no guest records, recordings, signed media URLs, credentials, or application code. Routes are templates without session identifiers.

## Scope and evidence

- Entry point: Home (`/app/home/oceansatarthurs`); authenticated venue context confirmed.
- Evidence labels: **CONFIRMED** means visible UI or route observed; **INFERRED** means a likely entity or relation; **UNKNOWN** means no evidence; **NEEDS TESTING** means an unperformed interaction.
- `INSPECTED` means content/controls were opened; `NAV_ONLY` means only the link and its destination were observed in navigation. A listed route is not evidence of its contents or permission eligibility.
- This checkpoint did not submit bookings, requests, payments, marketing messages, settings, or user accounts.

## Major functional domains

| ID | Domain | Evidence |
|---|---|---|
| DOM-01 | Home and navigation | CONFIRMED navigation or screen |
| DOM-02 | Reservations and seating | CONFIRMED navigation or screen |
| DOM-03 | Requests | CONFIRMED navigation or screen |
| DOM-04 | Clients | CONFIRMED navigation or screen |
| DOM-05 | Marketing and voice | CONFIRMED navigation or screen |
| DOM-06 | Online sales | CONFIRMED navigation or screen |
| DOM-07 | Reporting | CONFIRMED navigation or screen |
| DOM-08 | Availability and venue settings | CONFIRMED navigation or screen |
| DOM-09 | People and permissions | CONFIRMED navigation or screen |
| DOM-10 | Integrations and widgets | CONFIRMED navigation or screen |

## Screens inspected

| ID | Screen | Route | Parent | Visible components, actions, and data | Validation and gaps |
|---|---|---|---|---|---|
| SCR-001 | Home | `/app/home/oceansatarthurs` | Global navigation | Upcoming Covers week; Revenue prompts; VIP reservations; Select date/shift; open report; refresh covers | CONFIRMED: card routes lead to reservations, reports, marketing; submit/error path UNKNOWN |
| SCR-002 | Reservations day | `/manager/oceansatarthurs/reservations/day/:date` | Global navigation | Month picker; Group by; Availability links; Add Reservation; select day; open existing reservation; Fields: Search; Table: Observed table or grid | CONFIRMED: can show canceled/no-show reservations; list aggregates reservations and covers; submit/error path UNKNOWN |
| SCR-003 | Add Reservation slideout | `/manager/oceansatarthurs/reservations/day/:date (slideout)` | Reservations day; Grid; Floorplan | Availability time slots and pacing; client lookup; payment; Book Reservation (not submitted); Fields: Date, Guests, Shift, Duration, Seating Area, Phone, Name, or Email, Search sources, Reservation Tags, Reservation Notes, Table, Booked By | CONFIRMED: defaults include 1 hr 30 min duration in observed shift; reservation phone and last name requirements shown in venue settings; submit/error path UNKNOWN |
| SCR-004 | Grid | `/manager2/oceansatarthurs/:date/reservations/grid` | Global navigation | Date; Shift; time slots; Add Reservation; select date/shift; Table: Observed table or grid | CONFIRMED: area heading includes manual-assignment-only bar in observed shift; submit/error path UNKNOWN |
| SCR-005 | Floorplan | `/manager2/oceansatarthurs/:date/reservations/floorplan` | Global navigation | Date; Shift; reservation cards; Add Reservation; select date/shift | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-006 | Requests | `/manager/oceansatarthurs/requests/all` | Global navigation | Status groups; date, shift, source, assignee filters; sort; Add Request; filter requests; Export; Fields: Reservation Date, Search; Table: Observed table or grid | CONFIRMED: observed empty state says No requests for this day; submit/error path UNKNOWN |
| SCR-007 | Add Request slideout | `/manager/oceansatarthurs/requests/all (slideout)` | Requests | Availability; client lookup; notes; Request (not submitted); Fields: Date, Guests, Reservation Time Between, Phone, Name, or Email, Request Notes, Booked By | CONFIRMED: notes state they are not included in request notification to guest; submit/error path UNKNOWN |
| SCR-008 | Clients directory | `/manager/oceansatarthurs/clients` | Global navigation | Add profile; Filters; Venues; Search; Add profile; open profile; Fields: Search; Table: Observed table or grid | CONFIRMED: paginated result count and sort by visits were visible; submit/error path UNKNOWN |
| SCR-009 | Create client profile | `/manager/oceansatarthurs/clients/create` | Clients directory | Identity; notes; tags; Save (not submitted); cancel; Fields: First name, Last Name, Salutation, Job Title, Company, Profile notes, Private notes, Tags, Email, Alt email, Phone, Work phone… | CONFIRMED: notes show 5000-character counter; contact visibility can be restricted to superusers; submit/error path UNKNOWN |
| SCR-010 | Venue profile information | `/manager2/oceansatarthurs/marketing/venueprofile` | Marketing | Venue Information; Review Sites; Social Media Links; Save Changes (not submitted); Cancel; Fields: Address, Cross Street, City, State / Province, Postal Code, Country, Phone, Primary Contact, Website, Menu Link, Google Maps Link, Booking Link… | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-011 | Auto-tags activity | `/manager2/oceansatarthurs/marketing/autotags/` | Marketing | Date filter; activity chart; last applied timestamp; Change date range; Fields: Start date, End date; Table: Observed table or grid | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-012 | Smart Boost | `/manager2/oceansatarthurs/marketing/smart-boost/` | Marketing | Benefits; How It Works; Get Started; Activate Boost Now (not activated) | CONFIRMED: account displayed an activation landing page; active campaign controls not inspected; submit/error path UNKNOWN |
| SCR-013 | Guest Satisfaction | `/manager2/oceansatarthurs/marketing/reviews/` | Marketing | Summary ratings; sentiment; platform counts; Export; search; filter; Fields: Search; Table: Observed table or grid | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-014 | Voice AI Call Dashboard | `/app/voice/oceansatarthurs` | Marketing > Voice AI | Call counts; time saved; reservation covers; Filter calls; open settings; Fields: Category, Action taken, Date filter; Table: Observed table or grid | CONFIRMED: recording links are present; recording content not opened; submit/error path UNKNOWN |
| SCR-015 | Voice AI Settings | `/app/voice/oceansatarthurs/settings` | Voice AI Call Dashboard | Agent Configuration; Venue Details; Advanced tabs; Save Changes (not submitted); Fields: Tone of Voice, Primary language, Call Transfer, Cross-Sell, Venue name, Time format, Hours, FAQ, Custom Instructions, Greeting variants, Pronunciation Dictionary, Off-topic threshold… | CONFIRMED: up to five custom instructions at 1000 characters each; immutable PII/assistant/conduct rules displayed; submit/error path UNKNOWN |
| SCR-016 | Offers | `/manager2/oceansatarthurs/marketing/experiences2/` | Online Sales | Template cards; inactive entries; Offers Directory; Create New Offer; Use Template; item menu | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-017 | Create Offer | `/manager2/oceansatarthurs/marketing/experiences2/create/` | Offers | Overview; details; rich text; Save as Draft; Publish Offer (not submitted); Cancel; Fields: Offer Name, Default Party Size, Price, Description Title, Description Body, Menu file, Display on Widget, Header Image, Alternative Images | CONFIRMED: image limit shown under 2MB; alternative images up to 8; submit/error path UNKNOWN |
| SCR-018 | Reservation Upgrades | `/app/prearrivals/oceansatarthurs/upgrades` | Online Sales | Included in package; feature explanation; steps; Get started (not activated); Learn more | CONFIRMED: page shows onboarding rather than an upgrade list; submit/error path UNKNOWN |
| SCR-019 | Automated Emails | `/manager2/oceansatarthurs/marketing/email-center/emails/` | Marketing > Email | Metric cards; trend chart; campaign table; Filter; sort; pagination; Fields: Status, Automated Emails, Date Filters; Table: Observed table or grid | CONFIRMED: empty campaign table observed in selected view; submit/error path UNKNOWN |
| SCR-020 | Email Settings | `/manager2/oceansatarthurs/marketing/email-settings/` | Marketing > Email | Guest-Facing Contact; Audience Opt-In Classification; Save Changes (not submitted); Fields: Sender Name, Sender Role, Email Address, Explicit/Implicit Consent, Privacy Link, Policy Holder Name | CONFIRMED: email campaigns only send to explicitly opted-in guests according to page copy; automated email default classification configurable; submit/error path UNKNOWN |
| SCR-021 | Reporting Home | `/manager2/oceansatarthurs/reporting/home` | Global navigation | Highlighted reports; categorized report links; Find a report; open report; Fields: Find a report | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-022 | Reservation Summary report | `/manager2/oceansatarthurs/reporting/embed/dashboards/129` | Reporting > Reservation Dashboards | Looker iframe; tiles and chart; dashboard actions; Filter; hide filters; tile actions; Fields: Reservation Date, Date Granularity, Shift, Reservation Status, Client Tag, Reservation Tag, Marketing Opt In, Reporting Period; Table: Observed table or grid | CONFIRMED: displayed definition excludes canceled/no-show from net covers; submit/error path UNKNOWN |
| SCR-023 | Venue Settings | `/manager2/oceansatarthurs/settings/venue` | Settings > General | Internal Team Emails; Guest Email/Text; Reservations; Save Changes (not submitted); Fields: Internal summary email toggles, Guest notification delivery, Reminder shifts, Required booking contact fields, Duplicate reservation scope, Seating default, Paylink collection, Service charge, Gratuity | CONFIRMED: widget booking notification always sends; internal booking notification configurable; submit/error path UNKNOWN |
| SCR-024 | Availability Settings | `/app/availability/oceansatarthurs/availability-settings` | Settings > Availability | Shifts and Modes tabs; weekly calendar; mode type navigation; Create Shift (not submitted); select date; select mode; Fields: Date range, Mode Type | CONFIRMED: mode changes apply to all referenced shifts according to page text; submit/error path UNKNOWN |
| SCR-025 | User Accounts | `/manager/oceansatarthurs/access/user/list` | Settings > People | Users grouped by access level; access explanation; Add new; open user; Export; Table: Observed table or grid | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-026 | Add User | `/manager/oceansatarthurs/access/user/create` | User Accounts | Account information; access level; additional options; Create; Create + Add Another (not submitted); Fields: First Name, Last Name, Email, Job Title, Access Level, Email Alerts, Mobile MFA, Suspended, Granular Permissions, Email Subscriptions, Create same access at other venues | CONFIRMED: selectable access levels and granular permissions; auto-assign requests described as round-robin in UI; submit/error path UNKNOWN |
| SCR-027 | Tax Rates | `/manager/oceansatarthurs/manage/tax_rates` | Settings > General | Venue rows; tax type column; Save tax rates (not submitted); Add tax column; Fields: Tax Type, Rate percent; Table: Observed table or grid | Field rules NEEDS TESTING; submit/error path UNKNOWN |
| SCR-030 | Guestlists Export | `/manager2/oceansatarthurs/reporting/embed/looks/128` | Reporting | Looker filter bar; results grid; No Results empty state; Filter; export; Fields: Guestlist date, status, covers, contact, tags, prepayment fields; Table: Guestlist export result | Export definitions and populated rows NEEDS TESTING; submit/error path UNKNOWN |
| SCR-059 | Client Tags | `/manager/oceansatarthurs/manage/tags` | Settings > General | Local and Global categories; enabled and disabled groups; tag rows; Add category; Fields: Category, tag, show on reservation/chit | Creation and deletion not submitted; submit/error path UNKNOWN |
| SCR-060 | Reservation Tags | `/manager/oceansatarthurs/manage/reservationtags` | Settings > General | Categories and tag rows; disabled categories; Add category; Fields: Category, tag, show on reservation/chit | Creation and deletion not submitted; submit/error path UNKNOWN |
| SCR-061 | Payment Processors | `/manager2/oceansatarthurs/settings/payment-integration/view` | Settings > Integrations | Stripe integration card; connection details; offline state; Test integration; Fields: Processor | Payment connection and charges NEEDS TESTING; submit/error path UNKNOWN |
| SCR-062 | Email Service Providers | `/manager2/oceansatarthurs/settings/emailserviceproviders/` | Settings > Integrations | Emma and Mailchimp cards; Authenticate | Authentication not performed; submit/error path UNKNOWN |
| SCR-063 | Point of Sale | `/manager2/oceansatarthurs/settings/posi/view` | Settings > Integrations | Square for Restaurants; Lightspeed K/O; Oracle MICROS Simphony; Set Up Integration; More integrations | No connection initiated; submit/error path UNKNOWN |
| SCR-064 | Table Status Updates | `/manager2/oceansatarthurs/settings/table-status-mapping/` | Settings > Integrations | Connection onboarding; CSV menu upload description; menu-to-status mapping description; Connect a point of sale | Requires POS connection to configure mapping; submit/error path UNKNOWN |
| SCR-065 | Reservations on DoorDash | `/manager2/oceansatarthurs/settings/doordash-integration` | Settings > Integrations | Online indicator; venue details; description; Copy marketplace link; edit listing; Fields: Cuisine, Description, Menu, Images | Images require JPG/JPEG/PNG, at least 1400×800 pixels, under 2 MB; listing not edited; submit/error path UNKNOWN |
| SCR-066 | Access Rules | `/manager2/oceansatarthurs/settings/availability/accessrules` | Settings > Availability | Weekly calendar; compact/expanded; list view; Create Access Rule; Review Changes; Fields: Name, start/end dates, weekdays, shifts/times, party size, seating, booking channels, audiences, durations, upgrades, tags, booking window… | Unsaved drawer inspected; Review Changes disabled in observed state; submit/error path UNKNOWN |
| SCR-067 | Daily Program | `/manager/oceansatarthurs/manage/program` | Settings > Availability | Week calendar; date selector; shift blocks; Previous/next week; select date; Fields: Date | Shift editing not tested; submit/error path UNKNOWN |
| SCR-068 | Blackout Dates | `/manager/oceansatarthurs/manage/blackoutdates` | Settings > Availability | Date/Day/Description/Blackout grid; Add new; Save changes; Fields: Date, Description, Blackout | Blackout restricts external reservations for whole day while internal users can still book; submit/error path UNKNOWN |
| SCR-069 | Concierge Perks | `/manager/oceansatarthurs/manage/perks/list` | Settings > Availability | No perks created empty state; Add new | Perk creation form opened separately; submit/error path UNKNOWN |
| SCR-070 | Availability Quick View | `/manager2/oceansatarthurs/availability` | Settings > Availability | Date; audience; access rule; Select date/audience/area; inspect slot; Fields: Date, Audience, Access Rule, Seating Area | Slot detail NEEDS TESTING; submit/error path UNKNOWN |
| SCR-071 | Shift Reporting Periods | `/manager2/oceansatarthurs/settings/shift-reporting-periods` | Settings > Availability | Period group; Brunch/Lunch/Dinner/Night schedule controls; Add Shift Period Group; Save Changes; Fields: Group name, period times, enabled periods | Changes not submitted; submit/error path UNKNOWN |
| SCR-072 | Reservation Widget | `/manager/oceansatarthurs/settings/widgets/dining` | Settings > Widget Settings | Migration prompt; theme; font; Preview; Set Up Now; Remind Me Later; Fields: Theme, Font, Colors, Images, Button Text | Embed snippet and signed policy links omitted; submit/error path UNKNOWN |
| SCR-073 | Waitlist Widget | `/manager/oceansatarthurs/settings/widgets/waitlist` | Settings > Widget Settings | Inherited formatting; button; link/embed; Save; Fields: Button Text, Button Color, Minimum Guests, Maximum Guests, Show Wait Times, Opt-ins, Buffer, Arrival Time | No settings saved; submit/error path UNKNOWN |
| SCR-074 | Subscription Widget | `/manager2/oceansatarthurs/settings/subscription` | Settings > Widget Settings | Formatting; logo; button; Save Changes; Fields: Primary Color, Logo Header, Button Text, Button Color, Redirect URL, Salutation, Birthday, Postal Code, Dietary Restrictions, Marketing Opt-ins, reCAPTCHA | Form fields offer Hidden/Required/Optional where shown; no settings saved; submit/error path UNKNOWN |
| SCR-075 | Landing Page Settings | `/manager2/oceansatarthurs/settings/landingpage` | Settings > Widget Settings | Header text; venue banner; attention message; Add New Button; reorder buttons; Fields: Header Text, Buttons, Links | Landing page styles inherit reservation widget styles; no change saved; submit/error path UNKNOWN |
| SCR-076 | Custom Audiences | `/manager2/oceansatarthurs/settings/custom-audiences/view` | Settings > Widget Settings | Empty table; API availability description; Add; Fields: Name, Client ID, Widget URL, Is active | Add form not inspected; submit/error path UNKNOWN |
| SCR-093 | Create Concierge Perk | `/manager/oceansatarthurs/manage/perks/create` | Settings > Availability > Concierge Perks | Perk details; date range; weekday and concierge selection; Save changes (not submitted); Fields: Perk, Staff Instructions, Additional Information, Collateral Link, Start Date, End Date, Weekdays, Concierge Access | CONFIRMED: Perk and Staff Instructions marked required; Additional Information shows 500-character limit; submit/error path UNKNOWN |

## Navigation listed, content not inspected

| ID | Screen | Route | Parent | Status |
|---|---|---|---|---|
| SCR-028 | Revenue | `/manager2/oceansatarthurs/reporting/revenue` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-029 | Covers Calendar | `/manager2/oceansatarthurs/reporting/embed/dashboards/358` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-031 | Payments Export | `/manager2/oceansatarthurs/reporting/embed/looks/50` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-032 | Reservations Export | `/manager2/oceansatarthurs/reporting/embed/looks/49` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-033 | Booked By | `/manager2/oceansatarthurs/reporting/embed/dashboards/130` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-034 | Cross-Promotion Conversion | `/manager2/oceansatarthurs/reporting/embed/dashboards/299` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-035 | Daily Snapshot | `/manager2/oceansatarthurs/reporting/embed/dashboards/136` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-036 | Experiences Reporting | `/manager2/oceansatarthurs/reporting/embed/dashboards/395` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-037 | Feedback and Server Trends | `/manager2/oceansatarthurs/reporting/embed/dashboards/428` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-038 | Flexible Table Capacity Reporting | `/manager2/oceansatarthurs/reporting/embed/dashboards/480` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-039 | Guest List | `/manager2/oceansatarthurs/reporting/embed/dashboards/334` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-040 | No-Show / Short-Show | `/manager2/oceansatarthurs/reporting/embed/dashboards/279` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-041 | POS Check Linking Report | `/manager2/oceansatarthurs/reporting/embed/dashboards/447` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-042 | Performance Comparison: Monthly | `/manager2/oceansatarthurs/reporting/embed/dashboards/51` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-043 | Performance Comparison: Weekly | `/manager2/oceansatarthurs/reporting/embed/dashboards/104` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-044 | Policy Fees Reporting | `/manager2/oceansatarthurs/reporting/embed/dashboards/397` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-045 | Priority Alerts & Request Reporting | `/manager2/oceansatarthurs/reporting/embed/dashboards/415` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-046 | Sourced By | `/manager2/oceansatarthurs/reporting/embed/dashboards/280` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-047 | Top Spenders | `/manager2/oceansatarthurs/reporting/embed/dashboards/135` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-048 | Turn Time Analysis | `/manager2/oceansatarthurs/reporting/embed/dashboards/313` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-049 | Turndown Summary | `/manager2/oceansatarthurs/reporting/embed/dashboards/332` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-050 | Utilization | `/manager2/oceansatarthurs/reporting/embed/dashboards/330` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-051 | Upgrades Reporting | `/manager2/oceansatarthurs/reporting/embed/dashboards/335` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-052 | Waitlist Snapshot | `/manager2/oceansatarthurs/reporting/embed/dashboards/100` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-053 | Upgrades Export | `/manager2/oceansatarthurs/reporting/embed/looks/160` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-054 | Search Reservations | `/manager/oceansatarthurs/search/reservations` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-055 | Search Payments | `/manager/oceansatarthurs/reports/payments` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-056 | Actuals | `/manager/oceansatarthurs/actuals` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-057 | Outgoing Emails | `/manager2/oceansatarthurs/reporting/outgoingemails` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-058 | Activity Log | `/manager/oceansatarthurs/activitylog` | Reporting | CONFIRMED link; content NEEDS TESTING |
| SCR-077 | Floorplan Layouts | `/app/availability/oceansatarthurs/floorplan-layouts/list` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-078 | Rooms | `/manager/oceansatarthurs/manage/capacity/rooms/edit` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-079 | Seating Areas | `/manager/oceansatarthurs/manage/capacity/areas/edit` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-080 | Tables | `/manager/oceansatarthurs/manage/capacity/table/edit` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-081 | Table Combinations | `/app/availability/oceansatarthurs/table-combinations` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-082 | Reservation Statuses | `/manager/oceansatarthurs/manage/service_status` | Settings > Floorplan | CONFIRMED link; content NEEDS TESTING |
| SCR-083 | Booked By Names | `/manager/oceansatarthurs/manage/bookedbynames/edit` | Settings > People | CONFIRMED link; content NEEDS TESTING |
| SCR-084 | Server Names | `/manager/oceansatarthurs/manage/servernames/edit` | Settings > People | CONFIRMED link; content NEEDS TESTING |
| SCR-085 | Emails | `/manager2/oceansatarthurs/settings/email_settings/` | Settings > Guest-Facing Language | CONFIRMED link; content NEEDS TESTING |
| SCR-086 | Text | `/manager2/oceansatarthurs/settings/sms_settings/` | Settings > Guest-Facing Language | CONFIRMED link; content NEEDS TESTING |
| SCR-087 | Policies | `/manager2/oceansatarthurs/settings/policy_settings/` | Settings > Guest-Facing Language | CONFIRMED link; content NEEDS TESTING |
| SCR-088 | Language Settings | `/manager2/oceansatarthurs/settings/language_settings/` | Settings > Guest-Facing Language | CONFIRMED link; content NEEDS TESTING |
| SCR-089 | Imports | `/app/imports/oceansatarthurs` | Settings > Reservation & Client Imports | CONFIRMED link; content NEEDS TESTING |
| SCR-090 | Text Marketing | `/app/webstore/oceansatarthurs/marketing/text` | Available upgrades | CONFIRMED link; content NEEDS TESTING |
| SCR-091 | Email Marketing | `/app/webstore/oceansatarthurs/marketing/email` | Available upgrades | CONFIRMED link; content NEEDS TESTING |
| SCR-092 | Event Management | `/app/webstore/oceansatarthurs/marketing/event-management` | Available upgrades | CONFIRMED link; content NEEDS TESTING |

## Major workflows

| ID | Workflow | Screen path | Verified boundary |
|---|---|---|---|
| FLOW-001 | Home to reservation day | SCR-001 → SCR-002 | Date card opens a day list (CONFIRMED) |
| FLOW-002 | Internal reservation entry | SCR-002 → SCR-003 | Form inspected; booking not submitted (NEEDS TESTING) |
| FLOW-003 | Request creation | SCR-006 → SCR-007 | Form inspected; notification not sent (NEEDS TESTING) |
| FLOW-004 | Client profile creation | SCR-008 → SCR-009 | Form inspected; profile not saved (NEEDS TESTING) |
| FLOW-005 | Offer creation | SCR-016 → SCR-017 | Editor inspected; draft and publish not submitted (NEEDS TESTING) |
| FLOW-006 | User account creation | SCR-025 → SCR-026 | Role and permissions form inspected; user not created (NEEDS TESTING) |
| FLOW-007 | Shift and Mode configuration | SCR-024 | Calendar and Modes tab inspected; no change saved (NEEDS TESTING) |
| FLOW-008 | Reporting directory to dashboard | SCR-021 → SCR-022 | Embedded dashboard with filter controls opened (CONFIRMED) |
| FLOW-009 | Voice AI monitoring to settings | SCR-014 → SCR-015 | Dashboard and three settings tabs opened (CONFIRMED) |
| FLOW-010 | Concierge perk creation | SCR-069 → SCR-093 | Empty list and create form opened; save not submitted (NEEDS TESTING) |
| FLOW-011 | Access rule creation | SCR-066 | Calendar and create drawer opened; review and save not submitted (NEEDS TESTING) |

## Cross-screen findings

- **CONFIRMED:** Global navigation exposes Home, Reservations, Grid, Floorplan, Requests, Clients, Marketing, Online Sales, Reporting, available upgrades, Settings, search, venue selection, and profile menu.
- **CONFIRMED:** Settings groups General, Integrations, Availability, Widget Settings, Floorplan, People, Guest-Facing Language, and Imports.
- **CONFIRMED:** Reporting has categorized dashboards and exports, including an embedded Reservation Summary dashboard with date, shift, status, tag, and reporting-period filters. Other reports remain NAV_ONLY.
- **CONFIRMED:** Internal reservation booking offers availability search, client lookup, payment options, source, tags, table and booked-by; required contact controls are configurable in Venue Settings.
- **CONFIRMED:** User creation exposes access levels and granular permission checkboxes. Cross-role enforcement is NEEDS TESTING.
- **INFERRED:** Reservation, client, shift, table, request, offer, report, user, role, review, call, and payment are likely data entities; no database schema was observed.

## Uninspected areas and constraints

- All `NAV_ONLY` entries in the registry need content and interaction inspection. This includes most embedded reports, most Settings subsections, and upgrade product pages.
- Existing reservation detail, client profile detail, request thread detail with data, report exports, payment actions, and staff mobile workflows were not inspected.
- No page was confirmed inaccessible for permission reasons in this pass. A navigation-only link may still deny access when opened; this remains UNKNOWN.
- No destructive, payable, external messaging, activation, or production data modification workflow was executed.
- Validation, sorting, pagination, empty states beyond Requests and Automated Emails, and error conditions remain NEEDS TESTING.

## Exact next discovery action

Open `SCR-028` Revenue from Reporting, record its filters, tiles, actions, and any inaccessible state, then continue the remaining Reporting entries in ID order. Update this inventory and feature registry after each bounded batch.
