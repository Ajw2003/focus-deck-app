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
- [Benha University study] *Employing Inclusive UX Design Considerations in Color for Autistic
  Children*. https://bu.edu.eg/staff/Monamohamed15-publications/56165

Limits of this evidence: the strongest sources are guidance (W3C, Home Office, NN/g) and qualitative
studies; controlled studies with autistic or ADHD adults on specific layouts, colours or motion are
scarce, and two of the studies are about children. Where the evidence is thin, aj's testing decides.
