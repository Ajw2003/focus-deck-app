# Calm by default: designing Focus Deck for ADHD, autistic and other neurodivergent users

Research note, 2026-10-18. Asked for by aj after the "Board takes over" proposal looked too busy:
"this is meant for the adhd autistic user i am and for any neurodivergent user". The decision page
is `docs/plans/calm-by-default.html`; the prototype is
`docs/generated/board-merge/prototype.html#calm` (pictures in `docs/generated/calm/`).

## What the sources say

### 1. Show less at once, and reveal detail on request

- W3C's cognitive accessibility guidance has a whole objective, "Help users focus", whose summary is
  "Avoid distracting the user from their tasks", with patterns including "Avoid too much content",
  "Limit interruptions" and "Make short critical paths" [W3C COGA, §4 objective 5].
- Nielsen Norman Group: progressive disclosure shows a small set of core options first and moves the
  rest behind a clear control; designs past two levels "typically have low usability" [NN/g].
- Monotropism, a theory of autism from autistic researchers, describes attention concentrated in a
  few "attention tunnels" at a time, which makes it harder to take in many inputs at once or to
  switch between them [Murray, Lesser & Lawson 2005; National Autistic Society].
- UK Home Office autism poster: "build simple and consistent layouts", not "complex and cluttered
  layouts" [Home Office].

### 2. Be predictable and consistent

- Home Office autism poster: simple, consistent layouts [Home Office].
- WCAG 2.2, 3.2.3 Consistent Navigation (AA): repeated navigation stays in the same relative order
  [WCAG 2.2].
- W3C COGA: "Use a Consistent Visual Design", "Ensure Controls and Content Do Not Move Unexpectedly",
  "Make Each Step Clear" [W3C COGA, §4 objectives 1 and 4].
- A 2026 systematic mapping study of accessible interfaces for autistic children found the most common
  approaches were configurable profiles, sensory stimulus control and predictable interface elements
  [RBIE 2026 mapping study]. Note: children, and most studies lacked real-world validation.

### 3. Literal, plain words

- Home Office autism poster: "write in plain language", don't "use figures of speech and idioms";
  "make buttons descriptive", not "vague and unpredictable" [Home Office].
- W3C COGA: "Use Literal Language", "Use Clear Words", "Clearly Identify Controls and Their Use"
  [W3C COGA, §4 objective 3].

### 4. Calm colour and motion, under the user's control

- Home Office autism poster: "use simple colours", not "bright contrasting colours" [Home Office].
- Research on colour for autistic children: colour can help engagement and also lead to overload and
  anxiety [Benha University study]. Children again; treat as a direction, not a measured effect.
- WCAG 2.2: 2.2.2 Pause, Stop, Hide (A) and 2.3.3 Animation from Interactions (AAA): motion that
  starts by itself or comes from interaction can be stopped or turned off [WCAG 2.2].
- W3C COGA objective 8, "Support Adaptation and Personalization": "Let Users Control When the Content
  Moves or Changes", "Support Simplification", "Support a Personalized and Familiar Interface"
  [W3C COGA, §4 objective 8].

### 5. Low friction, no shame, clear next steps

- Adults with ADHD on task management (22 interviews, 20 concept sessions): starting is the core
  barrier; heavy setup and extra steps raise anxiety; punitive overdue lists add shame, and gentle,
  non-judgemental reflection helped; people want suggestions, not decisions made for them
  [Chen, Meng & Nie, CSCW 2026]. Qualitative study; concepts were not built and tested.
- Adults with ADHD are dissatisfied with the digital time-management tools available to them
  [Desrochers, Tuson & Magee, ASSETS 2019].
- Home Office anxiety poster: let users check their answers before they submit; don't leave users
  uncertain about the consequences of their actions or confused about next steps [Home Office].

### 6. Build it with the people it is for

- A review of ADHD technology research by neurodivergent researchers found that technologies mostly
  aim to "mitigate" ADHD against neurotypical norms, and that little research invites people with ADHD
  to co-construct the technology [Spiel, Hornecker, Williams & Good, CHI 2022]. For Focus Deck this
  means aj's own testing (the QA loop) is the main method, and the defaults should follow it.

### 7. Space with a purpose, controls next to what they act on

Added 2026-10-18 at aj's request: "big empty space without reason and ui elements seemingly anchored
without purpose makes me less inclined to like the design and to use it".

- Proximity: "Items close together are likely to be perceived as part of the same group"; an action
  placed far from the content it affects is hard to find and can be misread by its neighbours
  [NN/g proximity].
- On a wide screen, show a list and the selected item's detail side by side, and fall back to one pane
  on narrow screens [Android list-detail; Salesforce Lightning, minimum 1024px].
- W3C COGA: "Make the Relationship Clear Between Controls and the Content They Affect"
  [W3C COGA, §4 objective 1].

Space audit of the current app at 1920 and 1440 wide (`docs/generated/space-audit/now-*.png`):

| Screen | Empty without reason | Placed without purpose |
|---|---|---|
| Every screen | none | The jotter is centred on the window while the content starts after the side menu, so it lines up with nothing |
| Focus | little; folders and labels fill the width | none beyond the jotter |
| Sort | a large empty area under the slip and its buttons | the step bar stretches about 1,180px with small text in it |
| Board (today) | "In progress" and "Done this week" each take a third of the width to say "Nothing…" | none |
| Board (calm draft) | about 900px right of the 760px list | "Project", "Filter" and "+ New" sit at the far right edge, about 650px from the list they control |
| Projects | none | label chips sit at the far right of each row, up to about 1,000px from the task name |

What the reworked calm Board does (`docs/generated/board-merge/prototype.html#calm-wide`,
pictures `docs/generated/space-audit/calm-wide-*.png`): the list keeps a reading width (up to
640px) and the space beside it shows the selected task's details; the toolbar sits directly above
the list it filters; one column shows at a time, so there are no empty columns; the jotter ends on
the content's right edge, the same edge as the task panel. On a phone the task opens full screen.

Follow-up, same day (aj: the side bar is "too close and too small in comparison to other ui", and
the name and jotter "still seem off"): measured at 1920 wide, the side menu is 84px wide, 20px from
the content (`app/css/app.css:1082-1083`), with the name hung outside the header (`:1087`) and the
jotter centred on the window. Layout A (`prototype.html#calm-wide-a`, pictures
`docs/generated/layout/`) makes one 232px left column with the name, full-size screen rows and
Settings, 48px from the content, and starts the content column with the jotter at the list's width
(both 356px to 996px). Layout B (`#calm-wide-b`) keeps the narrow menu at 112px with 30px icons,
48px from the content at 1920 wide. The phone layout is unchanged in both.

### 8. Glance first, read deeper only when needed

aj, after trying the test site: show "1/2 subtasks completed" at a glance and keep "colors for
projects and labels, colors and / or icons allow users to read at a glance and infer quickly ...
make quick inference easy and deep inference with proper pondering only when required".

- Colour (hue) and simple shape are "preattentive": the eye picks them out in under about 200–250 ms,
  within a single glance and without focused attention, while reading words needs attention
  [Healey & Enns 2012].
- W3C COGA: "Use Icons that Help the User", and "Use a Consistent Visual Design" [W3C COGA, §4
  objective 1].

So each card has two layers. The glance layer is the project's colour (card edge and dot), label
chips in their own colours (up to two, then "+N"), a small icon per state (subtasks, waiting, holds
up, past its date), and subtask progress as "1/2 done" with a bar that fills from the left. The read
layer is the task panel: notes, every link and every label. Every icon sits beside its word, never
alone. This reverses the first version of answer 3 on the decision page (one colour per card, labels
in grey): colours stay, softened, never removed. Test site: `docs/generated/calm-test/index.html`.

## Where Focus Deck stands (checked against the code, 2026-10-18)

| Finding | Focus Deck today | Gap |
|---|---|---|
| Show less at once | Board shows 3 columns, 19 project pills and every card; the Board proposal added search, two pill rows and filters on top | Too much on one screen |
| Reveal on request | Sort's three parts already do this; the task panel proposal does too | Board and Projects don't |
| Predictable | Rail, step bar and slip stay put | Board cards vary in height and content |
| Literal words | "Bin it", "Later", "slip it back in the deck", "Stick on flags", "Tie to tasks", "In-tray", "Surprise me" | Several figures of speech |
| Calm colour | Every project and every one of 45 labels has its own colour; cards mix both | Many bright colours at once |
| Motion under control | Respects the system's reduce-motion setting (`app/css/app.css:156`, `:209`, `:459`); wallet cards tilt and flip | No in-app switch |
| No shame | Overdue is always red (`docs/4-systems/due-dates.md:18`) | Red can read as failure |
| Clear next step | Sort explains why a step is locked (planned) | Board has no "what next" cue beyond Focus |

## Sources

- [W3C COGA] W3C, *Making Content Usable for People with Cognitive and Learning Disabilities*, Working
  Group Note, 29 April 2021. https://www.w3.org/TR/coga-usable/
- [WCAG 2.2] W3C, *Web Content Accessibility Guidelines 2.2*. https://www.w3.org/TR/WCAG22/ and
  Understanding 3.2.3: https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html
- [NN/g] Jakob Nielsen, *Progressive Disclosure*, Nielsen Norman Group.
  https://www.nngroup.com/articles/progressive-disclosure/
- [Home Office] UK Home Office Digital, *Dos and don'ts on designing for accessibility* posters
  (autistic spectrum; anxiety), CC BY-NC-SA 4.0. Text read from the SVG sources:
  https://github.com/UKHomeOffice/posters/tree/master/accessibility/dos-donts ; background:
  https://accessibility.blog.gov.uk/author/karwaipun
- [Spiel et al., CHI 2022] K. Spiel, E. Hornecker, R. M. Williams, J. Good, *ADHD and Technology
  Research – Investigated by Neurodivergent Readers*, CHI '22, article 547.
  https://doi.org/10.1145/3491102.3517592 (open access: https://dare.uva.nl/id/b5158a6b-ee52-48a7-b4be-772d430bad4a)
- [Chen, Meng & Nie, CSCW 2026] J. Chen, Y. Meng, K. Nie, *"Not Just Me and My To-Do List":
  Understanding Challenges of Task Management for Adults with ADHD and the Need for AI-Augmented
  Social Scaffolds*, accepted to CSCW 2026. https://arxiv.org/abs/2603.17258
- [Desrochers et al., ASSETS 2019] B. Desrochers, E. Tuson, J. Magee, *Evaluation of why individuals
  with ADHD struggle to find effective digital time management tools*, ASSETS 2019, pp. 603–605.
  https://commons.clarku.edu/faculty_computer_sciences/15
- [Murray, Lesser & Lawson 2005] D. Murray, M. Lesser, W. Lawson, *Attention, monotropism and the
  diagnostic criteria for autism*, Autism 9(2), 2005. Summary: National Autistic Society,
  https://www.autism.org.uk/advice-and-guidance/professional-practice/what-is-monotropism
- [RBIE 2026 mapping study] Systematic mapping of accessible interfaces for autistic children, Revista
  Brasileira de Informática na Educação. https://journals-sol.sbc.org.br/index.php/rbie/article/view/7245
- [Healey & Enns 2012] C. G. Healey, J. T. Enns, *Attention and Visual Memory in Visualization and
  Computer Graphics*, IEEE Transactions on Visualization and Computer Graphics 18(7), 2012.
  https://www.csc2.ncsu.edu/faculty/healey/download/tvcg.11.pdf
- [NN/g proximity] Nielsen Norman Group, *Proximity Principle in Visual Design*.
  https://www.nngroup.com/articles/gestalt-proximity/
- [Android list-detail] Android Developers, *Canonical layouts: list-detail*.
  https://developer.android.com/guide/topics/large-screens/large-screen-canonical-layouts
- [Salesforce Lightning] Lightning Design System, *Layout guidelines* (master-detail on 1024px and up).
  https://spring-20.lightningdesignsystem.com/guidelines/layout
- [Benha University study] *Employing Inclusive UX Design Considerations in Color for Autistic
  Children*. https://bu.edu.eg/staff/Monamohamed15-publications/56165

Limits of this evidence: the strongest sources are guidance (W3C, Home Office, NN/g) and qualitative
studies; controlled studies with autistic or ADHD adults on specific layouts, colours or motion are
scarce, and two of the studies are about children. Where the evidence is thin, aj's testing decides.

### 9. Category colour, a labelled move, and nothing selected by default

aj, after trying the test site (2026-10-19): moving a task from Up next to In progress needs an
easier way than "Focus on this", which doesn't say the task moves; a project's name shouldn't show
on cards when you are already in that project; a task's colour should come from its category, not
its project, and replace the glance row's chips, with the other labels in the task panel; and a
task should be deselectable so nothing is highlighted.

What the test site now does (`docs/generated/calm-test/index.html`, pictures
`docs/generated/calm-test/feedback/`):

- Every Up next card has a "→ In progress" button, and every In progress card has "← Up next". The
  task panel has "Move to In progress" (or "Move back to Up next") on its own row above Save.
- A task's category is its first label. It sets the card's edge colour and is the only label chip on
  the card, with a coloured square beside its name; a task with no labels shows a grey
  "No category". Every label, the category first, is in the panel under "Category and labels".
- The project's name is plain text after the category, and is hidden when the Project menu is set to
  one project.
- Nothing is selected when the Board opens. Clicking the selected card again, pressing Escape, or
  "Close ×" on the panel deselects it, and the panel says how to choose one.

aj confirmed that "category" means the task's own first label (Chore, Bug, Study), and added that
priority, due date and labels the person chooses should be able to take precedence over it. So:

- Settings has a "Card colour" list, by default Category, then Priority, then Due date. Each card
  takes its colour and its one chip from the first item on the list that the task has, with ↑ Up and
  ↓ Down to reorder. "Add a label to the list" puts a chosen label at the top, so any task with it
  shows it; added labels can be removed again.
- Priority shows as "Urgent priority" and so on; Due date shows as "Past its date", "Due today",
  "Due in 2 days" or "Due 24 Oct". When Due date is the card's chip, the separate past-its-date
  glance chip is left out so it isn't said twice.
- For one task, its panel lists each label on its own row, the first marked "Category" and the rest
  with "Make category", which moves that label to the front. When something other than the category
  sets the card, the panel says which Settings item did. The panel's priority and date now change
  the card straight away.

### 10. A calmer task panel and Settings behind one row each

aj (2026-10-19): the Board is now good, but the task panel "is now too cluttered-looking and
duplicates functionality in a way that is not needed", and each setting "needs to be put behind
something so that it isn't just all out at once". The rationale for the whole app, in aj's words:
"show only what is needed and benefit the user but make it easy to access and obvious where to
access the information you need. out of sight, out of mind is something very hard to regulate when
too much in sight and too much on mind is the alternative."

Task panel, what was cut or merged (pictures `feedback/before-panel-subtasks.png` and
`feedback/after-panel-*.png`):

- The header line repeated the card's category, project and status. It is now a status menu
  (Up next, In progress, Done) followed by "in <project>", which also replaces the separate
  "Move to In progress" button.
- Save is gone: every change already applies as it is made, so the footer says "Changes save as
  you make them." beside Focus on this and Delete.
- Subtasks, Waits on, Holds up and Part of show only when the task has some, so an unlinked task has
  no "Nothing." headings; one "+ Add a subtask or link" replaces the per-section add buttons.
- The subtask count moved into the Subtasks heading ("1 of 2 done") instead of a second progress
  bar, and only a waiting subtask carries a word beside it.
- Labels are one line of chips with "Edit"; "Make category" appears only after Edit.
- The note saying which setting chose the card's colour is gone; the Settings row shows the order.

Settings: each setting is one row with its name, its current value on the right and an arrow.
Tapping a row opens its choices and closes any other open row, so only one setting's details are
on screen; changing a value updates the row's value straight away.

### 11. The task panel becomes "Task details", folded like Settings

aj (2026-10-19): Settings is good now; the task panel should "gain a name that encapsulates its
functionality" and work "the same as settings, the thing named and then details hidden gracefully
and able to be seen when wanted".

The panel is now headed "Task details" (with "Close ×"), then the task's title and its status menu
with "in <project>". Everything else is five folded rows built by the same helper as Settings, so
they look and behave the same: Notes (first line, or "None"), Priority and due date ("High priority ·
Due in 2 days", or "None set"), Labels (their names in order, the first being the category),
Subtasks ("1 of 2 done"), and Linked tasks ("Waits on 1, holds up 2", or "None"). Every row always
shows, even when empty, so each part is always in the same place; opening one row closes the
other open row, and each row's summary updates as soon as its details change. Inside Labels, each
label has its own row with "Category" or "Make category"; inside Subtasks and Linked tasks are the
add buttons. Pictures: `feedback/after-details-*.png`.
