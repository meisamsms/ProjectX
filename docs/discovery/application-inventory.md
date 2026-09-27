# SevenRooms application inventory — PHASE-01 checkpoint

Status: **IN PROGRESS**. Authorized Ocean’s at Arthur’s manager UI, observed 2026-09-26. No application code, guest records, signed URLs, account identifiers, message bodies or protected text reproduced.

## Counts and evidence

- 10 domains; 16 modules; 133 known screens; 0 fully inspected; 132 partially inspected; 1 package inaccessible; 0 navigation only.
- OBSERVED means visible under the current account. UNKNOWN is unobserved. INACCESSIBLE means an explicit package notice. All other roles remain UNKNOWN.
- Partial status alone does not block DISC-002 when the only missing behavior requires prohibited writes, other roles or unavailable permissions. Safe nested coverage gaps still block verification.

## Modules

Home, Reservations, Requests, Clients, Marketing, Voice AI, Online Sales, Reporting, General Settings, Integrations, Availability, Widgets, Floorplan, People, Guest-Facing Language, Imports.

## Screens

| ID | Screen / route | Navigation parent | Observed components, controls and rules | Classification / gap |
|---|---|---|---|---|
| SCR-001 | Home (/app/home/oceansatarthurs) | Global navigation | Upcoming Covers week; Revenue prompts; VIP reservations; Guest Satisfaction preview; learning and upsell cards | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-002 | Reservations day (/manager/oceansatarthurs/reservations/day/:date) | Global navigation | Month picker; Group by; Availability links; Cover Flow; grouped reservation rows; summary counts; Fields: Search | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-003 | Add Reservation slideout (/manager/oceansatarthurs/reservations/day/:date (slideout)) | Reservations day; Grid; Floorplan | Availability time slots and pacing; client lookup; payment; source; tags; notes; table; Fields: Date, Guests, Shift, Duration, Seating Area, Phone, Name, or Email, Search sources, Reservation Tags, Reservation Notes, Table, Booked By | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-004 | Grid (/manager2/oceansatarthurs/:date/reservations/grid) | Global navigation | Date; Shift; time slots; pacing counts; seating areas and table capacities | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-005 | Floorplan (/manager2/oceansatarthurs/:date/reservations/floorplan) | Global navigation | Date; Shift; reservation cards; area labels Main, West Wing, Bar, Sushi Bar | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-006 | Requests (/manager/oceansatarthurs/requests/all) | Global navigation | Status groups; date, shift, source, assignee filters; sort; search; request grid; Fields: Reservation Date, Search | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-007 | Add Request slideout (/manager/oceansatarthurs/requests/all (slideout)) | Requests | Availability; client lookup; notes; booked by; messaging choice; Fields: Date, Guests, Reservation Time Between, Phone, Name, or Email, Request Notes, Booked By | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-008 | Clients directory (/manager/oceansatarthurs/clients) | Global navigation | Add profile; Filters; Venues; Tags; Exclude Tag; row selection; merge; pagination; Fields: Search | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-009 | Create client profile (/manager/oceansatarthurs/clients/create) | Clients directory | Identity; notes; tags; contact; dates; privacy; loyalty; language; Fields: First name, Last Name, Salutation, Job Title, Company, Profile notes, Private notes, Tags, Email, Alt email, Phone, Work phone, Address, City, State, Postal code, Country, Birthday, Anniversary, Gender, Loyalty ID, Loyalty Tier, Loyalty Rank, Preferred Language | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-010 | Venue profile information (/manager2/oceansatarthurs/marketing/venueprofile) | Marketing | Venue Information; Review Sites; Social Media Links; Fields: Address, Cross Street, City, State / Province, Postal Code, Country, Phone, Primary Contact, Website, Menu Link, Google Maps Link, Booking Link, Avg Spend / Cover, Avg Spend / Order, Review site URLs, Social media URLs | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-011 | Auto-tags activity (/manager2/oceansatarthurs/marketing/autotags/) | Marketing | Date filter; activity chart; last applied timestamp; Fields: Start date, End date | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-012 | Smart Boost (/manager2/oceansatarthurs/marketing/smart-boost/) | Marketing | Benefits; How It Works | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-013 | Guest Satisfaction (/manager2/oceansatarthurs/marketing/reviews/) | Marketing | Summary ratings; sentiment; platform counts; review grid; Fields: Search | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-014 | Voice AI Call Dashboard (/app/voice/oceansatarthurs) | Marketing > Voice AI | Call counts; time saved; reservation covers; revenue; category chart; call table; Fields: Category, Action taken, Date filter | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-015 | Voice AI Settings (/app/voice/oceansatarthurs/settings) | Voice AI Call Dashboard | Agent Configuration; Venue Details; Advanced tabs; Fields: Tone of Voice, Primary language, Call Transfer, Cross-Sell, Venue name, Time format, Hours, FAQ, Custom Instructions, Greeting variants, Pronunciation Dictionary, Off-topic threshold, Dietary wording | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-016 | Offers (/manager2/oceansatarthurs/marketing/experiences2/) | Online Sales | Template cards; inactive entries; Offers Directory | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-017 | Create Offer (/manager2/oceansatarthurs/marketing/experiences2/create/) | Offers | Overview; details; rich text; file/image uploads; display controls; Fields: Offer Name, Default Party Size, Price, Description Title, Description Body, Menu file, Display on Widget, Header Image, Alternative Images | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-018 | Reservation Upgrades (/app/prearrivals/oceansatarthurs/upgrades) | Online Sales | Included in package; feature explanation; steps | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-019 | Automated Emails (/manager2/oceansatarthurs/marketing/email-center/emails/) | Marketing > Email | Metric cards; trend chart; campaign table; Fields: Status, Automated Emails, Date Filters | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-020 | Email Settings (/manager2/oceansatarthurs/marketing/email-settings/) | Marketing > Email | Guest-Facing Contact; Audience Opt-In Classification; Fields: Sender Name, Sender Role, Email Address, Explicit/Implicit Consent, Privacy Link, Policy Holder Name | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-021 | Reporting Home (/manager2/oceansatarthurs/reporting/home) | Global navigation | Highlighted reports; categorized report links; Fields: Find a report | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-022 | Reservation Summary report (/manager2/oceansatarthurs/reporting/embed/dashboards/129) | Reporting > Reservation Dashboards | Looker iframe; tiles and chart; dashboard actions; Fields: Reservation Date, Date Granularity, Shift, Reservation Status, Client Tag, Reservation Tag, Marketing Opt In, Reporting Period | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-023 | Venue Settings (/manager2/oceansatarthurs/settings/venue) | Settings > General | Internal Team Emails; Guest Email/Text; Reservations; Charges tabs; Fields: Internal summary email toggles, Guest notification delivery, Reminder shifts, Required booking contact fields, Duplicate reservation scope, Seating default, Paylink collection, Service charge, Gratuity | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-024 | Availability Settings (/app/availability/oceansatarthurs/availability-settings) | Settings > Availability | Shifts and Modes tabs; weekly calendar; mode type navigation; Fields: Date range, Mode Type | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-025 | User Accounts (/manager/oceansatarthurs/access/user/list) | Settings > People | Users grouped by access level; access explanation | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-026 | Add User (/manager/oceansatarthurs/access/user/create) | User Accounts | Account information; access level; additional options; subscriptions; other locations; Fields: First Name, Last Name, Email, Job Title, Access Level, Email Alerts, Mobile MFA, Suspended, Granular Permissions, Email Subscriptions, Create same access at other venues | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-027 | Tax Rates (/manager/oceansatarthurs/manage/tax_rates) | Settings > General | Venue rows; tax type column; Fields: Tax Type, Rate percent | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-028 | Revenue (/manager2/oceansatarthurs/reporting/revenue) | Reporting | Date filter; revenue headline; opportunity carousel; regional benchmark; feature performance | PARTIALLY_INSPECTED_WITH_REASON: Five feature expansions and explanation inspected. Remaining safe date/sort and package-marked feature panels still need inspection; no demo requests or configuration changes submitted. |
| SCR-029 | Covers Calendar (/manager2/oceansatarthurs/reporting/embed/dashboards/358) | Reporting | Looker month grid; daily shift cells; calendar navigation | PARTIALLY_INSPECTED_WITH_REASON: Download and delivery dialogs inspected without submission. Dashboard filter popovers, tile actions and calendar drilldowns still need safe inspection; other roles and delivery outcomes untested. |
| SCR-030 | Guestlists Export (/manager2/oceansatarthurs/reporting/embed/looks/128) | Reporting | Looker filter bar; results grid; No Results empty state; Fields: Guestlist date, status, covers, contact, tags, prepayment fields | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-031 | Payments Export (/manager2/oceansatarthurs/reporting/embed/looks/50) | Reporting | Looker Explore; filters; sortable result grid; No Results | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-032 | Reservations Export (/manager2/oceansatarthurs/reporting/embed/looks/49) | Reporting | Looker Explore; filters; populated sortable result grid | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-033 | Booked By (/manager2/oceansatarthurs/reporting/embed/dashboards/130) | Reporting | Looker dashboard; booking channel charts; spend and reservation proportions | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-034 | Cross-Promotion Conversion (/manager2/oceansatarthurs/reporting/embed/dashboards/299) | Reporting | Looker dashboard; retained/referred covers; trends; cancellations and no-shows | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-035 | Daily Snapshot (/manager2/oceansatarthurs/reporting/embed/dashboards/136) | Reporting | Looker dashboard; booked covers; reservations; spend; VIP tiles | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-036 | Experiences Reporting (/manager2/oceansatarthurs/reporting/embed/dashboards/395) | Reporting | Looker dashboard; revenue; reservations; popular experiences; covers | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-037 | Feedback and Server Trends (/manager2/oceansatarthurs/reporting/embed/dashboards/428) | Reporting | Looker dashboard; ratings; categories; party size; tables; server trends | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-038 | Flexible Table Capacity Reporting (/manager2/oceansatarthurs/reporting/embed/dashboards/480) | Reporting | Looker dashboard; revenue; reservations; covers | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-039 | Guest List (/manager2/oceansatarthurs/reporting/embed/dashboards/334) | Reporting | Looker dashboard; check-in performance; channel; attendance | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-040 | No-Show / Short-Show (/manager2/oceansatarthurs/reporting/embed/dashboards/279) | Reporting | Looker dashboard; cover/reservation counts; rates; shift and size charts | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-041 | POS Check Linking Report (/manager2/oceansatarthurs/reporting/embed/dashboards/447) | Reporting | Looker dashboard; linked-check report tile | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-042 | Performance Comparison: Monthly (/manager2/oceansatarthurs/reporting/embed/dashboards/51) | Reporting | Looker dashboard; covers; profiles; feedback; POS; spend; repeat visits | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-043 | Performance Comparison: Weekly (/manager2/oceansatarthurs/reporting/embed/dashboards/104) | Reporting | Looker dashboard; covers; spend; no-show; canceled charts | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-044 | Policy Fees Reporting (/manager2/oceansatarthurs/reporting/embed/dashboards/397) | Reporting | Looker dashboard; fee earnings; reservations with fees; cancellation rate | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-045 | Priority Alerts & Request Reporting (/manager2/oceansatarthurs/reporting/embed/dashboards/415) | Reporting | Looker dashboard; revenue; conversions; party size; lead time | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-046 | Sourced By (/manager2/oceansatarthurs/reporting/embed/dashboards/280) | Reporting | Looker dashboard; spend; reservations; cancellation rates; source detail | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-047 | Top Spenders (/manager2/oceansatarthurs/reporting/embed/dashboards/135) | Reporting | Looker dashboard; top spenders table tile | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-048 | Turn Time Analysis (/manager2/oceansatarthurs/reporting/embed/dashboards/313) | Reporting | Looker dashboard; duration comparison; weekday turn charts | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-049 | Turndown Summary (/manager2/oceansatarthurs/reporting/embed/dashboards/332) | Reporting | Looker dashboard; occurrences/covers by shift, party size, weekday and time | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-050 | Utilization (/manager2/oceansatarthurs/reporting/embed/dashboards/330) | Reporting | Looker dashboard; utilization and covers by shift/day | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-051 | Upgrades Reporting (/manager2/oceansatarthurs/reporting/embed/dashboards/335) | Reporting | Looker dashboard; revenue; sold; reservations; popular upgrades | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-052 | Waitlist Snapshot (/manager2/oceansatarthurs/reporting/embed/dashboards/100) | Reporting | Looker dashboard; quote accuracy; wait times; completion and abandonment | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-053 | Upgrades Export (/manager2/oceansatarthurs/reporting/embed/looks/160) | Reporting | Looker Explore; filter panel; result region | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-054 | Search Reservations (/manager/oceansatarthurs/search/reservations) | Reporting | Venue/date controls; search; tags; first 30 results; next link | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-055 | Search Payments (/manager/oceansatarthurs/reports/payments) | Reporting | Search; period/type/status selectors; transaction columns | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-056 | Actuals (/manager/oceansatarthurs/actuals) | Reporting | Editable daily reservation rows; spend fields; daily totals | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-057 | Outgoing Emails (/manager2/oceansatarthurs/reporting/outgoingemails) | Reporting | Location/date/type controls; search; email grid; pager | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-058 | Activity Log (/manager/oceansatarthurs/activitylog) | Reporting | Date range; event selectors; actor/action/IP audit feed | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-059 | Client Tags (/manager/oceansatarthurs/manage/tags) | Settings > General | Local and Global categories; enabled and disabled groups; tag rows; Fields: Category, tag, show on reservation/chit | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-060 | Reservation Tags (/manager/oceansatarthurs/manage/reservationtags) | Settings > General | Categories and tag rows; disabled categories; Fields: Category, tag, show on reservation/chit | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-061 | Payment Processors (/manager2/oceansatarthurs/settings/payment-integration/view) | Settings > Integrations | Stripe integration card; connection details; offline state; Fields: Processor | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-062 | Email Service Providers (/manager2/oceansatarthurs/settings/emailserviceproviders/) | Settings > Integrations | Emma and Mailchimp cards | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-063 | Point of Sale (/manager2/oceansatarthurs/settings/posi/view) | Settings > Integrations | Square for Restaurants; Lightspeed K/O; Oracle MICROS Simphony; Omnivore; SkyTab | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-064 | Table Status Updates (/manager2/oceansatarthurs/settings/table-status-mapping/) | Settings > Integrations | Connection onboarding; CSV menu upload description; menu-to-status mapping description | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-065 | Reservations on DoorDash (/manager2/oceansatarthurs/settings/doordash-integration) | Settings > Integrations | Online indicator; venue details; description; menu; image uploader; preview; Fields: Cuisine, Description, Menu, Images | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-066 | Access Rules (/manager2/oceansatarthurs/settings/availability/accessrules) | Settings > Availability | Weekly calendar; compact/expanded; list view; Create Access Rule drawer; Fields: Name, start/end dates, weekdays, shifts/times, party size, seating, booking channels, audiences, durations, upgrades, tags, booking window, limits, pacing | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-067 | Daily Program (/manager/oceansatarthurs/manage/program) | Settings > Availability | Week calendar; date selector; shift blocks; Fields: Date | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-068 | Blackout Dates (/manager/oceansatarthurs/manage/blackoutdates) | Settings > Availability | Date/Day/Description/Blackout grid; Fields: Date, Description, Blackout | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-069 | Concierge Perks (/manager/oceansatarthurs/manage/perks/list) | Settings > Availability | No perks created empty state | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-070 | Availability Quick View (/manager2/oceansatarthurs/availability) | Settings > Availability | Date; audience; access rule; seating area; party-size-by-time matrix; Fields: Date, Audience, Access Rule, Seating Area | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-071 | Shift Reporting Periods (/manager2/oceansatarthurs/settings/shift-reporting-periods) | Settings > Availability | Period group; Brunch/Lunch/Dinner/Night schedule controls; Fields: Group name, period times, enabled periods | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-072 | Reservation Widget (/manager/oceansatarthurs/settings/widgets/dining) | Settings > Widget Settings | Migration prompt; theme; font; colors; images; advanced styles; embed and direct link; Fields: Theme, Font, Colors, Images, Button Text | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-073 | Waitlist Widget (/manager/oceansatarthurs/settings/widgets/waitlist) | Settings > Widget Settings | Inherited formatting; button; link/embed; quote and waiting room settings; Fields: Button Text, Button Color, Minimum Guests, Maximum Guests, Show Wait Times, Opt-ins, Buffer, Arrival Time | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-074 | Subscription Widget (/manager2/oceansatarthurs/settings/subscription) | Settings > Widget Settings | Formatting; logo; button; embed/direct link; form field modes; consent controls; Fields: Primary Color, Logo Header, Button Text, Button Color, Redirect URL, Salutation, Birthday, Postal Code, Dietary Restrictions, Marketing Opt-ins, reCAPTCHA | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-075 | Landing Page Settings (/manager2/oceansatarthurs/settings/landingpage) | Settings > Widget Settings | Header text; venue banner; attention message; primary and secondary buttons; direct link; Fields: Header Text, Buttons, Links | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-076 | Custom Audiences (/manager2/oceansatarthurs/settings/custom-audiences/view) | Settings > Widget Settings | Empty table; API availability description; Fields: Name, Client ID, Widget URL, Is active | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-077 | Floorplan Layouts (/app/availability/oceansatarthurs/floorplan-layouts/list) | Settings > Floorplan | Layout cards; meal-period associations; sort and search; Fields: Layout | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-078 | Rooms (/manager/oceansatarthurs/manage/capacity/rooms/edit) | Settings > Floorplan | Abbreviation/name grid; room rows; Fields: Abbreviation, Name | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-079 | Seating Areas (/manager/oceansatarthurs/manage/capacity/areas/edit) | Settings > Floorplan | Abbreviation/name grid; seating areas; Fields: Abbreviation, Name | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-080 | Tables (/manager/oceansatarthurs/manage/capacity/table/edit) | Settings > Floorplan | 125 table rows; party size min/max; seating area; Fields: Table Number, Party Size Min, Party Size Max, Seating Area | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-081 | Table Combinations (/app/availability/oceansatarthurs/table-combinations) | Settings > Floorplan | Layout/count/action table; Fields: Layout, Combination Count | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-082 | Reservation Statuses (/manager/oceansatarthurs/manage/service_status) | Settings > Floorplan | Pre-service/in-service active/color controls; Fields: Active, Color | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-083 | Booked By Names (/manager/oceansatarthurs/manage/bookedbynames/edit) | Settings > People | Source name rows; Fields: Name | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-084 | Server Names (/manager/oceansatarthurs/manage/servernames/edit) | Settings > People | Server name rows; Fields: Name | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-085 | Emails (/manager2/oceansatarthurs/settings/email_settings/) | Settings > Guest-Facing Language | Template categories and View links; Fields: Template | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-086 | Text (/manager2/oceansatarthurs/settings/sms_settings/) | Settings > Guest-Facing Language | Transactional template categories and View links; Fields: Template | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-087 | Policies (/manager2/oceansatarthurs/settings/policy_settings/) | Settings > Guest-Facing Language | Booking/Cancellation/Other policy links; Fields: Policy | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-088 | Language Settings (/manager2/oceansatarthurs/settings/language_settings/) | Settings > Guest-Facing Language | Language and translation availability table; default controls; Fields: Language, Default | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-089 | Imports (/app/imports/oceansatarthurs) | Settings > Reservation & Client Imports | System selector; client and reservation file panels; template links; Fields: Source System, Client File, Reservation File | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-090 | Text Marketing (/app/webstore/oceansatarthurs/marketing/text) | Available upgrades | Upgrade benefits and onboarding | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-091 | Email Marketing (/app/webstore/oceansatarthurs/marketing/email) | Available upgrades | Upgrade benefits and onboarding | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-092 | Event Management (/app/webstore/oceansatarthurs/marketing/event-management) | Available upgrades | Upgrade benefits and onboarding | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-093 | Create Concierge Perk (/manager/oceansatarthurs/manage/perks/create) | Settings > Availability > Concierge Perks | Perk details; date range; weekday and concierge selection; Fields: Perk, Staff Instructions, Additional Information, Collateral Link, Start Date, End Date, Weekdays, Concierge Access | PARTIALLY_INSPECTED_WITH_REASON: Observed the page; live write, error, alternate-role and all filter branches were not tested. |
| SCR-094 | Group Clients Export (/manager2/oceansatarthurs/reporting/embed/looks/56) | Reporting > Exporting Reports | NO ACCESS package notice | INACCESSIBLE_WITH_REASON: Current package does not include this report; page asks for package update. |
| SCR-095 | Covers Calendar by Day Part (/manager2/oceansatarthurs/reporting/embed/dashboards/391) | Reporting > Covers Calendar | Looker calendar tile; Reservation Date filter | PARTIALLY_INSPECTED_WITH_REASON: Opened page; safe read-only controls seen; further states, validation and roles unknown. |
| SCR-096 | Floorplan Layout Editor (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | Settings > Floorplan | Canvas; Tables and Combinations tabs; zoom; add table/structure; undo/redo; Save; Exit; Fields: Zoom level, Adjust spacing between objects | PARTIALLY_INSPECTED_WITH_REASON: No canvas mutation, Save, Done creation, Delete, Duplicate, Deactivate or Move destination submitted. Selection-based editing controls and unlabeled presets still need safe inspection; persistence/validation and other roles untested. |
| SCR-097 | Reservation Confirmation (/manager2/oceansatarthurs/settings/email_settings/reservation_confirmation) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Clicking description and English value cells did not expose an editor. Loading indicator remained; further control availability UNKNOWN. No publish/delivery tested. |
| SCR-098 | Reservation Reminder (/manager2/oceansatarthurs/settings/email_settings/reservation_reminder) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-099 | Reservation Update (/manager2/oceansatarthurs/settings/email_settings/reservation_update) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-100 | Reservation Cancellation (/manager2/oceansatarthurs/settings/email_settings/reservation_cancellation) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-101 | Completed Transaction Language (/manager2/oceansatarthurs/settings/email_settings/completed_transaction_language) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-102 | Request Email (/manager2/oceansatarthurs/settings/email_settings/request_email) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-103 | Feedback Request Language (/manager2/oceansatarthurs/settings/email_settings/feedback_request_language) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-104 | Order Feedback Request Language (/manager2/oceansatarthurs/settings/email_settings/order_feedback_request_language) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-105 | Paylink Request Language (/manager2/oceansatarthurs/settings/email_settings/paylink_request_language) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-106 | Guestlist Confirmation (/manager2/oceansatarthurs/settings/email_settings/guestlist_confirmation) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-107 | Emails Priority Alerts (/manager2/oceansatarthurs/settings/email_settings/emails_priority_alerts) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-108 | Marketing Subscription Confirmation (/manager2/oceansatarthurs/settings/email_settings/marketing_subscription_confirmation) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-109 | Continued Marketing Subscription Confirmation Email (/manager2/oceansatarthurs/settings/email_settings/continued_marketing_subscription_confirmation_email) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-110 | Shared Email Links (/manager2/oceansatarthurs/settings/email_settings/shared_email_links) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-111 | Subscription Opt In (/manager2/oceansatarthurs/settings/email_settings/subscription_opt_in) | Settings > Emails | Description and English language grid; template labels; loading indicator | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-112 | Sms Event Res Language (/manager2/oceansatarthurs/settings/sms_settings/sms_event_res_language) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-113 | Sms Paylink (/manager2/oceansatarthurs/settings/sms_settings/sms_paylink) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-114 | Sms Priority Alerts (/manager2/oceansatarthurs/settings/sms_settings/sms_priority_alerts) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-115 | Sms Res Language (/manager2/oceansatarthurs/settings/sms_settings/sms_res_language) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-116 | Sms Transactional Auto Reply (/manager2/oceansatarthurs/settings/sms_settings/sms_transactional_auto_reply) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-117 | Sms Waitlist Language (/manager2/oceansatarthurs/settings/sms_settings/sms_waitlist_language) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-118 | Custom Sms (/manager2/oceansatarthurs/settings/sms_settings/custom_sms) | Settings > Text | Description and English grid; template rows | PARTIALLY_INSPECTED_WITH_REASON: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed. |
| SCR-119 | Booking Policies (/manager2/oceansatarthurs/settings/policy_settings/booking_policies) | Settings > Policies | Policy rows; English content; editing controls; Fields: Policy Name, English policy body | PARTIALLY_INSPECTED_WITH_REASON: Editable fields and creation control observed; no text entered or publication submitted. Validation, published outcome and other roles untested. |
| SCR-120 | Cancellation Policies (/manager2/oceansatarthurs/settings/policy_settings/payment_policies) | Settings > Policies | Policy rows; English content; editing controls; Fields: Policy Name, English policy body | PARTIALLY_INSPECTED_WITH_REASON: Editable fields and creation control observed; no text entered or publication submitted. Validation, published outcome and other roles untested. |
| SCR-121 | Other Policies (/manager2/oceansatarthurs/settings/policy_settings/other_policies) | Settings > Policies | Policy rows; English content; editing controls; Fields: Email Marketing Policy: Venue, Email Marketing Policy: Group, Custom Checkout Policy, Agree to Waitlist Policy, Text Marketing Policy: Venue, Group Booking Policy label, Group Booking Policy body, Tailored Communication Marketing Opt-In Label, Tailored Communication Marketing Policy Header, Tailored Communication Marketing Policy Body | PARTIALLY_INSPECTED_WITH_REASON: Policy text fields observed; no edits or publication. Validation and published outcomes require isolated test data; alternate roles untested. |
| SCR-122 | Add Custom Audience (/manager2/oceansatarthurs/settings/custom-audiences/add) | Settings > Custom Audiences | Name textbox; Active checkbox; Go back; Save; Fields: Name, Active | PARTIALLY_INSPECTED_WITH_REASON: Form inspected without typing or saving; required-name validation, creation result, API integration and alternate roles UNKNOWN. |

## Workflows

| ID | Entry and steps | Branches | Unverified outcomes |
|---|---|---|---|
| FLOW-001 Home to reservation day | SCR-001; SCR-001, SCR-002 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-002 Internal reservation entry | SCR-002; SCR-002, SCR-003 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-003 Request creation | SCR-006; SCR-006, SCR-007 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-004 Client profile creation | SCR-008; SCR-008, SCR-009 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-005 Offer creation | SCR-016; SCR-016, SCR-017 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-006 User account creation | SCR-025; SCR-025, SCR-026 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-007 Shift and Mode configuration | SCR-024; SCR-024 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-008 Reporting directory to dashboard | SCR-021; SCR-021, SCR-022 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-009 Voice AI monitoring to settings | SCR-014; SCR-014, SCR-015 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-010 Concierge perk creation | SCR-069; SCR-069, SCR-093 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-011 Access rule creation | SCR-066; SCR-066 | UNKNOWN | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-012 Import preparation | SCR-089; SCR-089 | Source system; client/reservation file | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-013 Floorplan layout editing | SCR-077; SCR-077, SCR-096 | Create or edit; Tables or Combinations | UNKNOWN_REQUIRES_SAFE_TEST_DATA; UNKNOWN_REQUIRES_SAFE_TEST_DATA |
| FLOW-014 Reporting dashboard filters | SCR-021; SCR-021, SCR-029 | Date, shift, report | OBSERVED dashboard rendered; UNKNOWN |

## Unknowns requiring verification

| ID | Description | Reason | Risk | Future method |
|---|---|---|---|---|
| U-001 | Live write outcomes | No production booking, payment, message, publish or import submitted | Success and validation unverified | Use isolated test venue and disposable records |
| U-002 | Other role permissions | Only current signed-in account available | Access may differ | Use authorized test accounts for each role |
| U-003 | Failures, pagination, sorting and branch details | Only bounded read-only interactions/current live data available | Hidden states remain | Exercise safe test data and filters |
| U-004 | Group Clients Export content | NO ACCESS package notice | Export fields unknown | Inspect with enabled package |
| U-005 | Missing decisions.json | Referenced file absent from repository checkpoint | Decision memory gap | Locate in history or create blank register later |
| U-006 | Message template publish/translation | Protected text avoided; no live publish | Workflow unknown | Use isolated test venue and locale |

## Reconciliation

- Every registry ID and route is represented in the table. Group Clients Export and Covers Calendar by Day Part were newly found in Reporting.
- Group Clients Export is inaccessible because this package displays NO ACCESS.
- docs/project-map/decisions.json is absent; Q-009 and U-005 preserve this gap. No final application map was built.


## Newly discovered nested surfaces

| ID | Screen / route | Parent | Observed controls | Classification / gap |
|---|---|---|---|---|
| SCR-123 | Name Floorplan Layout (/app/availability/oceansatarthurs/floorplan-layouts/editor/create) | SCR-096 | Layout name textbox; Cancel; Done; Fields: Layout name | PARTIALLY_INSPECTED_WITH_REASON: Name validation and creation require submitting a new layout; not attempted. |

| SCR-124 | Editor Settings (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | Five checkboxes; Close; Cancel; Done; Fields: Show Gridlines, Show Seating Area Labels, Show chairs around Tables, Lock Tables to their position on the Floorplan, Allow Objects to snap to the Grid | PARTIALLY_INSPECTED_WITH_REASON: Settings were read without toggling or applying; persistence and other-role behavior untested. |

| SCR-125 | Keyboard Shortcuts (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | General shortcuts; Table shortcuts; Structural shortcuts; Close | PARTIALLY_INSPECTED_WITH_REASON: Mutation shortcuts not executed; alternate platform and role behavior unknown. |

| SCR-126 | Add Table preset panel (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | Ten unlabeled preset buttons; Back to tables | PARTIALLY_INSPECTED_WITH_REASON: Preset selection would add a table to the draft canvas; not selected. Unlabeled shapes need visual inspection. |

| SCR-127 | Add Structural Element panel (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | Labels; Shapes; Furniture; Back to tables | PARTIALLY_INSPECTED_WITH_REASON: No element selected because that changes the draft canvas; shape details and resulting edit controls unobserved. |

| SCR-128 | Edit Table Combination (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | Tables textbox; Cover Min spinbutton; Cover Max spinbutton; Cancel; Save; Fields: Tables, Cover Min, Cover Max | PARTIALLY_INSPECTED_WITH_REASON: No values changed or saved; cover limits, invalid ranges, persistence and other roles unknown. |

| SCR-129 | Add Room dialog (/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId) | SCR-096 | Room Abbreviation textbox; Room Name textbox; Close; Cancel; Done; Fields: Room Abbreviation, Room Name | PARTIALLY_INSPECTED_WITH_REASON: Creation and required-field validation not submitted; other-role behavior unknown. |

| SCR-130 | New Booking Policy row (/manager2/oceansatarthurs/settings/policy_settings/booking_policies) | SCR-119 | Blank policy name textbox; Blank policy body textbox; Save and Publish on parent; Fields: Policy name, Policy body | PARTIALLY_INSPECTED_WITH_REASON: Creation control adds an unsaved row; no values entered or published. Validation and persistence require safe test data. |

| SCR-131 | Revenue opportunity explanation (/manager2/oceansatarthurs/reporting/revenue) | SCR-028 | Explanation dialog; Learn More link | PARTIALLY_INSPECTED_WITH_REASON: Explanation observed; independent calculation accuracy and other-role display untested. |

| SCR-132 | Covers Calendar Download dialog (/manager2/oceansatarthurs/reporting/embed/dashboards/358) | SCR-029 | Format combobox; Paper Size combobox; Expand tables checkbox; Single-column checkbox; Download; Cancel; Open in Browser; Fields: Format, Paper Size, Expand tables to show all rows, Arrange dashboard tiles in a single column | PARTIALLY_INSPECTED_WITH_REASON: No export generated; PDF paper-size choices and rendered output remain unverified. |

| SCR-133 | Covers Calendar Scheduled Plan Editor (/manager2/oceansatarthurs/reporting/embed/dashboards/358) | SCR-029 | Settings tab; Filters tab; Advanced options tab; Save; Cancel; Fields: Schedule Name, Recurrence, Time, Destination, Email addresses, Format, Custom Message, Include links, Expand tables to show all rows, Arrange dashboard tiles in a single column, Paper size, Delivery timezone, Bucket, Optional Path, Access Key, Secret Key, Region, Address, Username, Password, Preferred key exchange algorithm | PARTIALLY_INSPECTED_WITH_REASON: No recipients/credentials entered and no schedule saved or sent. Recurrence-specific branches, format-specific settings, delivery and integration outcomes remain UNKNOWN. |

## DISC-002 detailed continuation evidence — 2026-09-27

All statements below are OBSERVED unless explicitly UNKNOWN. No inferred architecture or role permissions added. Route-sharing dialogs use parentScreenId and surfaceKey; they are not invented URL routes. Counts include these nested surfaces.

### SCR-028 — Revenue

Route: `/manager2/oceansatarthurs/reporting/revenue`. Parent: Reporting.

- visibleComponents: ["Date filter", "revenue headline", "opportunity carousel", "regional benchmark", "feature performance"]
- cards: ["Five opportunity cards", "Feature performance accordions"]
- menus: ["Date filter options recorded previously"]
- filters: ["This month", "Last month", "Last 3 months", "Last 6 months", "Year to date", "Last year", "All time"]
- observedBusinessRules: ["Opportunity measured against regional benchmark; some cards require package update", "Automated Emails expansion shows campaign metrics, a revenue chart and Explore Report link.", "Other Prepayments expansion shows monthly revenue chart and accessible Month/Revenue/bg table.", "Cancellation fees, Experiences and Upgrades expand to descriptive benchmark/help panels."]
- unknowns: ["UNKNOWN: remaining feature accordion details and date/sort branches", "UNKNOWN: other-role behavior; package update badges observed for several features"]
- partialReason: Five feature expansions and explanation inspected. Remaining safe date/sort and package-marked feature panels still need inspection; no demo requests or configuration changes submitted.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-029 — Covers Calendar

Route: `/manager2/oceansatarthurs/reporting/embed/dashboards/358`. Parent: Reporting.

- visibleComponents: ["Looker month grid", "daily shift cells", "calendar navigation"]
- menus: ["Dashboard actions: Clear cache and refresh; Download; Schedule delivery; Reset filters"]
- filters: ["Shift Name", "Reservation Date", "Reporting Period Group Name"]
- loadingState: OBSERVED dashboard progressbar and Element Loading before populated month grid.
- populatedState: OBSERVED month grid containing daily shift reservations/covers and comparison arrows.
- observedBusinessRules: ["Links to separate Covers Calendar by Day Part"]
- unknowns: ["Page content and interactions not yet inspected"]
- partialReason: Download and delivery dialogs inspected without submission. Dashboard filter popovers, tile actions and calendar drilldowns still need safe inspection; other roles and delivery outcomes untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-077 — Floorplan Layouts

Route: `/app/availability/oceansatarthurs/floorplan-layouts/list`. Parent: Settings > Floorplan.

- visibleComponents: ["Layout cards", "meal-period associations", "sort and search"]
- cards: ["OBSERVED four layout cards with last-edited date, active/inactive table counts, combination counts and meal periods"]
- menus: ["Layout actions: Edit, Duplicate, Print"]
- fields: [{"name": "Layout", "type": "UNKNOWN", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- unknowns: ["UNKNOWN: Duplicate and Print outcomes; not activated"]
- partialReason: Observed the page; live write, error, alternate-role and all filter branches were not tested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-096 — Floorplan Layout Editor

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: Settings > Floorplan.

- visibleComponents: ["Canvas", "Tables and Combinations tabs", "zoom", "add table/structure", "undo/redo", "Save", "Exit"]
- tabs: ["Tables", "Combinations"]
- buttons: ["Exit Editor", "Add Table", "Add Structural Element", "Undo", "Redo", "Keyboard Shortcuts", "Settings", "Discard changes", "Save", "Room navigation", "Add room"]
- menus: ["Active table: Duplicate, Deactivate, Move to; Move to submenu lists other rooms. No destination selected.", "Combination: Edit, Delete. Edit opens SCR-128; Delete not activated."]
- fields: [{"name": "Zoom level", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Adjust spacing between objects", "type": "slider", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- sorting: OBSERVED Combinations offers Sort by Table and Sort by Party Size; Party Size selected without saving.
- loadingState: OBSERVED empty canvas and progressbar during load; populated canvas after load.
- populatedState: OBSERVED 29 tables on current-room canvas; active/inactive lists grouped by seating area; combination rows show tables and cover range.
- disabledState: OBSERVED Undo, Redo, Discard changes and Save disabled after unchanged layout finished loading.
- emptyStates: ["OBSERVED create-layout canvas empty before naming"]
- observedBusinessRules: ["UI guidance says active tables require a seating area; an active No Seating Area group was also visible, so enforcement remains UNKNOWN.", "UI guidance describes Shift/Command selection before adding a combination.", "Inactive table button labels state Enter adds them to the floorplan; not executed."]
- cancelBackBehavior: OBSERVED Exit Editor returns to layouts list; naming Cancel returns to list; nested Cancel/Close dismisses without saving.
- unknowns: ["UNKNOWN: selected-table and structural contextual editor details", "UNKNOWN: enforcement of seating-area guidance", "UNKNOWN_REQUIRES_SAFE_TEST_DATA: save, create, delete, move and duplicate outcomes"]
- partialReason: No canvas mutation, Save, Done creation, Delete, Duplicate, Deactivate or Move destination submitted. Selection-based editing controls and unlabeled presets still need safe inspection; persistence/validation and other roles untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-097 — Reservation Confirmation

Route: `/manager2/oceansatarthurs/settings/email_settings/reservation_confirmation`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email subject", "Email header", "Upgrades header", "Tip label", "Referred Perk Text", "Referral Link Subject", "Referral Link Body"]
- tables: [{"description": "Reservation Confirmation and Referrals grids", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... beneath populated sections
- unknowns: ["UNKNOWN: whether residual Loading... prevents additional controls", "UNKNOWN_REQUIRES_SAFE_TEST_DATA: editing, translation, publish and delivery"]
- partialReason: Clicking description and English value cells did not expose an editor. Loading indicator remained; further control availability UNKNOWN. No publish/delivery tested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-098 — Reservation Reminder

Route: `/manager2/oceansatarthurs/settings/email_settings/reservation_reminder`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email subject", "Email header", "Confirm Reservation button", "Cancel Reservation button"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-099 — Reservation Update

Route: `/manager2/oceansatarthurs/settings/email_settings/reservation_update`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email subject"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-100 — Reservation Cancellation

Route: `/manager2/oceansatarthurs/settings/email_settings/reservation_cancellation`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email subject", "Email body"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-101 — Completed Transaction Language

Route: `/manager2/oceansatarthurs/settings/email_settings/completed_transaction_language`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Complete payment header", "Complete payment subject", "Refund payment header"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-102 — Request Email

Route: `/manager2/oceansatarthurs/settings/email_settings/request_email`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Guestlist Request Paragraph", "Reservation Request Paragraph"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-103 — Feedback Request Language

Route: `/manager2/oceansatarthurs/settings/email_settings/feedback_request_language`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email header", "Email subject", "Email body"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-104 — Order Feedback Request Language

Route: `/manager2/oceansatarthurs/settings/email_settings/order_feedback_request_language`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Email header", "Email subject", "Email body"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-105 — Paylink Request Language

Route: `/manager2/oceansatarthurs/settings/email_settings/paylink_request_language`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Payment request subject", "Payment request body", "Payment request button", "Card hold request subject", "Card hold request body", "Card hold request button", "Payment request body with Expiration", "Card hold request body with Expiration", "Payment request subject reminder", "Card hold request subject reminder"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-106 — Guestlist Confirmation

Route: `/manager2/oceansatarthurs/settings/email_settings/guestlist_confirmation`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Guestlist Email Header", "Guestlist Email Body", "Guestlist Email Remove Link Text", "Guestlist Email QR Code Title", "Guestlist Email QR Code Description"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-107 — Emails Priority Alerts

Route: `/manager2/oceansatarthurs/settings/email_settings/emails_priority_alerts`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Priority Alerts Confirmation Email Header", "Priority Alerts Confirmation Not a Reservation", "Priority Alerts Confirmation Subject", "Priority Alerts Cancel Alert", "Priority Alerts Time Slot Opening Header", "Priority Alerts Time Slot Opening Button", "Priority Alerts Notification Subject"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-108 — Marketing Subscription Confirmation

Route: `/manager2/oceansatarthurs/settings/email_settings/marketing_subscription_confirmation`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Marketing subscription confirmation email subject", "Marketing subscription confirmation email header", "Marketing subscription confirmation email line 1", "Marketing subscription confirmation email line 2", "Marketing subscription confirmation email button label", "Marketing subscription confirmation email line 3", "Marketing subscription confirmation email line 4"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-109 — Continued Marketing Subscription Confirmation Email

Route: `/manager2/oceansatarthurs/settings/email_settings/continued_marketing_subscription_confirmation_email`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Marketing subscription confirmation email subject", "Marketing subscription confirmation email header", "Marketing subscription confirmation email line 1", "Marketing subscription confirmation email line 2", "Marketing subscription confirmation email button label", "Marketing subscription confirmation email line 3", "Marketing subscription confirmation email line 4"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-110 — Shared Email Links

Route: `/manager2/oceansatarthurs/settings/email_settings/shared_email_links`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Manage reservation link text", "Cancel reservation link text"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-111 — Subscription Opt In

Route: `/manager2/oceansatarthurs/settings/email_settings/subscription_opt_in`. Parent: Settings > Emails.

- visibleComponents: ["Description and English language grid", "template labels", "loading indicator"]
- templateRowLabels: ["Subscription Link Subject", "Subscription Link Body", "Subscription Link Text"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-112 — Sms Event Res Language

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_event_res_language`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Event Reservation - Confirmation", "Event Reservation - Updated", "Event Reservation - Reminder"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-113 — Sms Paylink

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_paylink`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Payment request text", "Payment request text with expiration", "Payment request text reminder", "Card hold request text", "Card hold request text with expiration", "Card hold request text reminder"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-114 — Sms Priority Alerts

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_priority_alerts`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Priority Alerts - Available Time Slot Text", "Priority Alerts - Canceled"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-115 — Sms Res Language

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_res_language`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Reservation - Confirmation", "Reservation - Updated", "Reservation - Canceled", "Reservation - Reminder", "Reservation - Table Ready", "Reservation - Arrival", "Reservation - Complete via link"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-116 — Sms Transactional Auto Reply

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_transactional_auto_reply`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Inbound Transactional Auto-Reply"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-117 — Sms Waitlist Language

Route: `/manager2/oceansatarthurs/settings/sms_settings/sms_waitlist_language`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: ["Waitlist - Added to List", "Waitlist - Guest Joined Via Widget", "Waitlist - Confirmed", "Waitlist - Canceled", "Waitlist - Table Ready"]
- tables: [{"description": "Guest-facing language grid", "columns": ["Description", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-118 — Custom Sms

Route: `/manager2/oceansatarthurs/settings/sms_settings/custom_sms`. Parent: Settings > Text.

- visibleComponents: ["Description and English grid", "template rows"]
- templateRowLabels: [""]
- tables: [{"description": "Guest-facing language grid", "columns": ["Custom Text", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Grid observed; editing, translation and delivery outcomes untested. Loading indicator remains; its cause and whether further controls should load are UNKNOWN. No publish/send performed.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-119 — Booking Policies

Route: `/manager2/oceansatarthurs/settings/policy_settings/booking_policies`. Parent: Settings > Policies.

- visibleComponents: ["Policy rows", "English content", "editing controls"]
- buttons: ["Create New Policy", "Save and Publish (not activated)"]
- fields: [{"name": "Policy Name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "English policy body", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- templateRowLabels: ["Default Booking Policy"]
- tables: [{"description": "Policy editor", "columns": ["Policy Name", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- observedBusinessRules: ["UI states policies appear in Access Rules policy dropdown and HTML can format the policy."]
- partialReason: Editable fields and creation control observed; no text entered or publication submitted. Validation, published outcome and other roles untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-120 — Cancellation Policies

Route: `/manager2/oceansatarthurs/settings/policy_settings/payment_policies`. Parent: Settings > Policies.

- visibleComponents: ["Policy rows", "English content", "editing controls"]
- buttons: ["Create New Policy", "Save and Publish (not activated)"]
- fields: [{"name": "Policy Name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "English policy body", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- templateRowLabels: ["Default Cancellation Policy"]
- tables: [{"description": "Policy editor", "columns": ["Policy Name", "English"]}]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- observedBusinessRules: ["UI states policies appear in Access Rules policy dropdown and HTML can format the policy."]
- partialReason: Editable fields and creation control observed; no text entered or publication submitted. Validation, published outcome and other roles untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-121 — Other Policies

Route: `/manager2/oceansatarthurs/settings/policy_settings/other_policies`. Parent: Settings > Policies.

- visibleComponents: ["Policy rows", "English content", "editing controls"]
- buttons: ["Save and Publish (not activated)"]
- fields: [{"name": "Email Marketing Policy: Venue", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Email Marketing Policy: Group", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Custom Checkout Policy", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Agree to Waitlist Policy", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Text Marketing Policy: Venue", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Group Booking Policy label", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Group Booking Policy body", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Tailored Communication Marketing Opt-In Label", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Tailored Communication Marketing Policy Header", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Tailored Communication Marketing Policy Body", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- templateRowLabels: ["Email Marketing Policy: Venue", "Email Marketing Policy: Group", "Custom Checkout Policy", "Agree to Waitlist Policy", "Text Marketing Policy: Venue", "Group Booking Policy label", "Group Booking Policy body", "Tailored Communication Marketing Opt-In Label", "Tailored Communication Marketing Policy Header", "Tailored Communication Marketing Policy Body"]
- loadingState: OBSERVED Loading... remains beneath populated grid
- populatedState: OBSERVED grid with labels and current English values; bodies omitted
- partialReason: Policy text fields observed; no edits or publication. Validation and published outcomes require isolated test data; alternate roles untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-122 — Add Custom Audience

Route: `/manager2/oceansatarthurs/settings/custom-audiences/add`. Parent: Settings > Custom Audiences.

- visibleComponents: ["Name textbox", "Active checkbox", "Go back", "Save"]
- fields: [{"name": "Name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Active", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}]
- populatedState: OBSERVED blank Name and checked Active
- partialReason: Form inspected without typing or saving; required-name validation, creation result, API integration and alternate roles UNKNOWN.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-123 — Name Floorplan Layout

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/create`. Parent: SCR-096.

- visibleComponents: ["Layout name textbox", "Cancel", "Done"]
- buttons: ["Cancel", "Done"]
- fields: [{"name": "Layout name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN", "placeholder": "Enter Layout name"}]
- cancelBackBehavior: OBSERVED Cancel returns to SCR-077 layout list.
- partialReason: Name validation and creation require submitting a new layout; not attempted.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-124 — Editor Settings

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["Five checkboxes", "Close", "Cancel", "Done"]
- buttons: ["Close", "Cancel", "Done"]
- fields: [{"name": "Show Gridlines", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}, {"name": "Show Seating Area Labels", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}, {"name": "Show chairs around Tables", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}, {"name": "Lock Tables to their position on the Floorplan", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": false}, {"name": "Allow Objects to snap to the Grid", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}]
- cancelBackBehavior: OBSERVED Cancel closes dialog.
- partialReason: Settings were read without toggling or applying; persistence and other-role behavior untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-125 — Keyboard Shortcuts

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["General shortcuts", "Table shortcuts", "Structural shortcuts", "Close"]
- buttons: ["Close"]
- observedBusinessRules: ["Displayed shortcuts include undo/redo, selection, nudging, rotation, duplication; T opens table menu, S opens structural menu; backspace deactivates a table or deletes a structure."]
- cancelBackBehavior: OBSERVED Close returns to canvas.
- partialReason: Mutation shortcuts not executed; alternate platform and role behavior unknown.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-126 — Add Table preset panel

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["Ten unlabeled preset buttons", "Back to tables"]
- buttons: ["Back to tables"]
- disabledState: OBSERVED Add Structural Element disabled while Add Table panel is open.
- cancelBackBehavior: OBSERVED Back to tables restores list.
- partialReason: Preset selection would add a table to the draft canvas; not selected. Unlabeled shapes need visual inspection.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-127 — Add Structural Element panel

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["Labels", "Shapes", "Furniture", "Back to tables"]
- buttons: ["Text", "Exit label", "Headphones label", "Arrow label", "Three unlabeled shapes", "Bar, booth, chair, sofa, stairs and piano presets", "Back to tables"]
- cancelBackBehavior: OBSERVED Back to tables restores list.
- partialReason: No element selected because that changes the draft canvas; shape details and resulting edit controls unobserved.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-128 — Edit Table Combination

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["Tables textbox", "Cover Min spinbutton", "Cover Max spinbutton", "Cancel", "Save"]
- buttons: ["Cancel", "Save"]
- fields: [{"name": "Tables", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Cover Min", "type": "number", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Cover Max", "type": "number", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- populatedState: OBSERVED existing table combination and numeric cover range.
- cancelBackBehavior: OBSERVED Cancel returns to combinations list.
- partialReason: No values changed or saved; cover limits, invalid ranges, persistence and other roles unknown.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-129 — Add Room dialog

Route: `/app/availability/oceansatarthurs/floorplan-layouts/editor/:layoutId`. Parent: SCR-096.

- visibleComponents: ["Room Abbreviation textbox", "Room Name textbox", "Close", "Cancel", "Done"]
- buttons: ["Close", "Cancel", "Done"]
- fields: [{"name": "Room Abbreviation", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN", "placeholder": "MAIN"}, {"name": "Room Name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN", "placeholder": "Main"}]
- emptyStates: ["OBSERVED both textboxes initially blank"]
- cancelBackBehavior: OBSERVED Cancel closes dialog.
- partialReason: Creation and required-field validation not submitted; other-role behavior unknown.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-130 — New Booking Policy row

Route: `/manager2/oceansatarthurs/settings/policy_settings/booking_policies`. Parent: SCR-119.

- visibleComponents: ["Blank policy name textbox", "Blank policy body textbox", "Save and Publish on parent"]
- fields: [{"name": "Policy name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN", "placeholder": "Enter policy name"}, {"name": "Policy body", "type": "textbox", "required": "UNKNOWN", "validation": "UNKNOWN", "placeholder": "Enter your policy"}]
- sorting: OBSERVED Combinations offers Sort by Table and Sort by Party Size; Party Size selected without saving.
- emptyStates: ["OBSERVED blank inline row"]
- cancelBackBehavior: OBSERVED reload removes unsaved blank row; original one-row grid restored.
- partialReason: Creation control adds an unsaved row; no values entered or published. Validation and persistence require safe test data.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-131 — Revenue opportunity explanation

Route: `/manager2/oceansatarthurs/reporting/revenue`. Parent: SCR-028.

- visibleComponents: ["Explanation dialog", "Learn More link"]
- sorting: OBSERVED Combinations offers Sort by Table and Sort by Party Size; Party Size selected without saving.
- observedBusinessRules: ["Displayed explanation defines feature opportunity from regional average revenue, then sums opportunities. Revenue uses POS spend and online prepayments; absent POS data uses estimated spend per cover."]
- cancelBackBehavior: OBSERVED Escape dismissed explanation.
- partialReason: Explanation observed; independent calculation accuracy and other-role display untested.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-132 — Covers Calendar Download dialog

Route: `/manager2/oceansatarthurs/reporting/embed/dashboards/358`. Parent: SCR-029.

- visibleComponents: ["Format combobox", "Paper Size combobox", "Expand tables checkbox", "Single-column checkbox", "Download", "Cancel", "Open in Browser"]
- fields: [{"name": "Format", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "options": ["PDF", "CSV"]}, {"name": "Paper Size", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "observedValue": "Fit Page To Dashboard"}, {"name": "Expand tables to show all rows", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Arrange dashboard tiles in a single column", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN"}]
- sorting: OBSERVED Combinations offers Sort by Table and Sort by Party Size; Party Size selected without saving.
- observedBusinessRules: ["OBSERVED CSV selection hides PDF paper/layout controls and Open in Browser.", "UI warning says large tables may render as text or limit rows."]
- cancelBackBehavior: OBSERVED Cancel dismisses without downloading.
- partialReason: No export generated; PDF paper-size choices and rendered output remain unverified.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

### SCR-133 — Covers Calendar Scheduled Plan Editor

Route: `/manager2/oceansatarthurs/reporting/embed/dashboards/358`. Parent: SCR-029.

- visibleComponents: ["Settings tab", "Filters tab", "Advanced options tab", "Save", "Cancel"]
- tabs: ["Settings", "Filters", "Advanced options"]
- fields: [{"name": "Schedule Name", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Recurrence", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "options": ["Send now", "Monthly", "Weekly", "Daily", "Hourly", "Minutes", "Specific months", "Specific days", "Datagroup update"]}, {"name": "Time", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "observedValue": "06:00"}, {"name": "Destination", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "options": ["Email", "Amazon S3", "SFTP"]}, {"name": "Email addresses", "type": "multi-value textbox", "required": "OBSERVED required", "validation": "OBSERVED at least one item required"}, {"name": "Format", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "observedValue": "PDF"}, {"name": "Custom Message", "type": "textbox", "required": "UNKNOWN", "validation": "OBSERVED 0/1500 counter"}, {"name": "Include links", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN", "checked": true}, {"name": "Expand tables to show all rows", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Arrange dashboard tiles in a single column", "type": "checkbox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Paper size", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Delivery timezone", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "observedValue": "America - New York"}, {"name": "Bucket", "type": "text", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Optional Path", "type": "text", "required": "UNKNOWN", "validation": "UNKNOWN"}, {"name": "Access Key", "type": "text", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Secret Key", "type": "textbox", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Region", "type": "combobox", "required": "UNKNOWN", "validation": "UNKNOWN", "observedValue": "US East (N. Virginia)"}, {"name": "Address", "type": "text", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Username", "type": "text", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Password", "type": "textbox", "required": "OBSERVED required", "validation": "UNKNOWN"}, {"name": "Preferred key exchange algorithm", "type": "combobox", "required": "OBSERVED required", "validation": "UNKNOWN", "observedValue": "Default"}]
- filters: ["Shift Name", "Reservation Date", "Reporting Period Group Name"]
- sorting: OBSERVED Combinations offers Sort by Table and Sort by Party Size; Party Size selected without saving.
- loadingState: OBSERVED Loading Scheduled Plans before editor appeared.
- disabledState: OBSERVED Save disabled with empty required fields for Email, Amazon S3 and SFTP.
- emptyStates: ["OBSERVED All (0), External (0) recipient categories and blank required destination fields"]
- cancelBackBehavior: OBSERVED Cancel dismisses editor; no schedule created.
- partialReason: No recipients/credentials entered and no schedule saved or sent. Recurrence-specific branches, format-specific settings, delivery and integration outcomes remain UNKNOWN.
- Role/permission evidence: OBSERVED current account only; other roles UNKNOWN.

## Additional unknowns

- U-007: Remaining safe nested control coverage. Reason: DISC-002 pass has not inspected every filter, tile, menu and contextual editor; NAV_ONLY=0 does not mean coverage complete. Risk: Missing product states or screens. Future verification: Continue per-screen read-only inspection in stable ID order; record new surfaces.
- U-008: Guest-language residual loading indicators. Reason: Populated grids still display Loading...; cause not observable from UI. Risk: Additional editor controls may be missing. Future verification: Revisit settled screen and inspect screenshot/visible controls without submitting changes.
- U-009: Floorplan seating-area guidance enforcement. Reason: Guidance requires area for active table while active No Seating Area group was visible. Risk: Incorrect activation rule. Future verification: Test activation and validation only in isolated venue with disposable table.

## Additional workflows

- FLOW-015 Calendar export configuration: {"id": "FLOW-015", "name": "Calendar export configuration", "status": "PARTIALLY_INSPECTED_WITH_REASON", "entryPoint": "SCR-029", "steps": ["SCR-029", "SCR-132"], "branches": "PDF or CSV; PDF paper/layout options", "statuses": "OBSERVED configuration only", "validation": "UNKNOWN: export output not generated", "successState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "failureState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "cancelBackBehavior": "OBSERVED Cancel closes without download", "crossModuleDependencies": ["SCR-029"], "unknownBehaviorIds": ["U-001", "U-002", "U-003"], "result": "No final action submitted"}
- FLOW-016 Calendar delivery configuration: {"id": "FLOW-016", "name": "Calendar delivery configuration", "status": "PARTIALLY_INSPECTED_WITH_REASON", "entryPoint": "SCR-029", "steps": ["SCR-029", "SCR-133"], "branches": "Email, S3, SFTP; Settings, Filters, Advanced options", "statuses": "OBSERVED configuration only", "validation": "OBSERVED required destination fields and disabled Save", "successState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "failureState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "cancelBackBehavior": "OBSERVED Cancel closes without saving", "crossModuleDependencies": ["SCR-029"], "unknownBehaviorIds": ["U-001", "U-002", "U-003"], "result": "No final action submitted"}
- FLOW-017 Booking policy draft preparation: {"id": "FLOW-017", "name": "Booking policy draft preparation", "status": "PARTIALLY_INSPECTED_WITH_REASON", "entryPoint": "SCR-119", "steps": ["SCR-119", "SCR-130"], "branches": "Existing fields or blank new inline row", "statuses": "OBSERVED configuration only", "validation": "UNKNOWN: no values or publish submitted", "successState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "failureState": "UNKNOWN_REQUIRES_SAFE_TEST_DATA", "cancelBackBehavior": "OBSERVED Reload discards empty unsaved row", "crossModuleDependencies": ["SCR-119"], "unknownBehaviorIds": ["U-001", "U-002", "U-003"], "result": "No final action submitted"}

## Gate and exact next discovery action

DISC-002 remains IN_PROGRESS. Zero NAV_ONLY entries does not satisfy nested coverage. DISC-003 remains PLANNED pending DISC-002; no Prompt 02 work performed. decisions.json remains absent, recorded only as Q-009/U-005.

SCR-029 Covers Calendar: open Shift Name, Reservation Date and Reporting Period Group Name filter popovers, then tile actions and safe calendar drilldowns; inspect without scheduling or exporting. Continue remaining DISC-002 Reporting/Settings screens in stable ID order. SCR-028 remaining feature/date/sort branches also remain open.

## DISC-002 access interruption and metadata correction — 2026-09-27

- OBSERVED: A read-only return to SCR-029 redirected to the SevenRooms login. Secure sign-in advanced to an emailed MFA code. The secure verification submission returned `submission_failed`; the rendered page remained at the verification form. No report filter, tile, or drilldown was accessible in this session. No lower-level code submission was attempted. This is an access interruption, not evidence that SCR-029 itself is inaccessible to the authorized account.
- NEEDS TESTING: SCR-029 Shift Name, Reservation Date and Reporting Period Group Name filter popovers; tile actions; safe calendar drilldowns; any nested surfaces they reveal. SCR-028 remaining feature/date/sort branches also remain.
- UNKNOWN: Cause of the secure verification submission failure; no site error was visible. U-010 records the reason, risk and future method.
- INFERRED: None. INACCESSIBLE: SCR-094 remains package-limited; no new product screen classified inaccessible.
- PREVIOUS FINDING: SCR-124–SCR-133 incorrectly inherited `childScreenIds` pointing at earlier floorplan dialogs; SCR-130–SCR-133 incorrectly inherited floorplan combination sorting. NEW FINDING: These copied references and sorting assertions were removed; true parent-to-child references remain on SCR-096, SCR-119, SCR-028 and SCR-029. REASON FOR CHANGE: Metadata copied from the Floorplan editor had no observation supporting those relations on sibling dialogs, policy, or Reporting surfaces. EVIDENCE: Existing `parentScreenId` and trigger observations in the prior checkpoint; registry structural audit today. This corrects documentation only, not the observed UI.

### Explicit partial boundary for currently targeted Reporting surfaces

#### SCR-029 Covers Calendar

- PARTIAL REASON: Safe nested inspection remains open because the authenticated session redirected to login on 2026-09-27; later write/role branches remain intentionally untested.
- UNVERIFIED BEHAVIOR: For SCR-029: three filter popovers, tile actions and safe drilldowns. For SCR-028: remaining feature/date/sort branches. For SCR-132/133: final export/delivery outcomes.
- WHY IT CANNOT BE SAFELY VERIFIED: The current browser is on MFA verification after session expiration; secure authentication submission failed. Export/delivery outcomes would disclose data or schedule messages; other roles unavailable.
- FUTURE TEST METHOD: After successful authorized authentication, inspect SCR-029 filters/tile/drill branches read-only, then SCR-028 branches; use isolated venue and authorized alternate accounts for unsafe/role outcomes.

#### SCR-028 Revenue

- PARTIAL REASON: Safe nested inspection remains open because the authenticated session redirected to login on 2026-09-27; later write/role branches remain intentionally untested.
- UNVERIFIED BEHAVIOR: For SCR-029: three filter popovers, tile actions and safe drilldowns. For SCR-028: remaining feature/date/sort branches. For SCR-132/133: final export/delivery outcomes.
- WHY IT CANNOT BE SAFELY VERIFIED: The current browser is on MFA verification after session expiration; secure authentication submission failed. Export/delivery outcomes would disclose data or schedule messages; other roles unavailable.
- FUTURE TEST METHOD: After successful authorized authentication, inspect SCR-029 filters/tile/drill branches read-only, then SCR-028 branches; use isolated venue and authorized alternate accounts for unsafe/role outcomes.

#### SCR-132 Covers Calendar Download dialog

- PARTIAL REASON: Safe nested inspection remains open because the authenticated session redirected to login on 2026-09-27; later write/role branches remain intentionally untested.
- UNVERIFIED BEHAVIOR: For SCR-029: three filter popovers, tile actions and safe drilldowns. For SCR-028: remaining feature/date/sort branches. For SCR-132/133: final export/delivery outcomes.
- WHY IT CANNOT BE SAFELY VERIFIED: The current browser is on MFA verification after session expiration; secure authentication submission failed. Export/delivery outcomes would disclose data or schedule messages; other roles unavailable.
- FUTURE TEST METHOD: After successful authorized authentication, inspect SCR-029 filters/tile/drill branches read-only, then SCR-028 branches; use isolated venue and authorized alternate accounts for unsafe/role outcomes.

#### SCR-133 Covers Calendar Scheduled Plan Editor

- PARTIAL REASON: Safe nested inspection remains open because the authenticated session redirected to login on 2026-09-27; later write/role branches remain intentionally untested.
- UNVERIFIED BEHAVIOR: For SCR-029: three filter popovers, tile actions and safe drilldowns. For SCR-028: remaining feature/date/sort branches. For SCR-132/133: final export/delivery outcomes.
- WHY IT CANNOT BE SAFELY VERIFIED: The current browser is on MFA verification after session expiration; secure authentication submission failed. Export/delivery outcomes would disclose data or schedule messages; other roles unavailable.
- FUTURE TEST METHOD: After successful authorized authentication, inspect SCR-029 filters/tile/drill branches read-only, then SCR-028 branches; use isolated venue and authorized alternate accounts for unsafe/role outcomes.

### Exact next discovery action

Resume the authorized SevenRooms session in this browser. Open SCR-029; inspect the Shift Name filter popover first, then Reservation Date and Reporting Period Group Name, tile actions and safe calendar drilldowns in that order. Do not execute DISC-003.
