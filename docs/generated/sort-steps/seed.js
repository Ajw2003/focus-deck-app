// Realistic sample data for the sort-steps screenshots: the same 19 projects and 45 categories as
// scripts/shoot-board.mjs, plus two thoughts in the tray and a few tasks to link to. Used by
// seed.html (the real app, "before") and prototype.html (the stepped design, "after").
const NAMES = ['Home', 'School', 'Website redesign', 'Band', 'Garden', 'Portfolio', 'Taxes and paperwork', 'Fitness', 'Kitchen renovation planning with the contractor', 'Reading list', 'Car', 'Holiday in Portugal', 'Open source: focus-deck', 'Finances', 'Photography', 'Family', 'Learning Rust', 'Volunteering', 'Shed rebuild'];
const COLORS = ['#3E8E5E', '#4D6FB8', '#C9584F', '#8A6FB8', '#2F8F8F', '#C2731E', '#B8527E', '#5B8C2A', '#6A6FD1', '#A8742B'];
const CAT_NAMES = ['Chore', 'Study', 'Bug', 'Art', 'Errand', 'Music', 'Writing', 'Admin', 'Call', 'Email', 'Buy', 'Plan', 'Research', 'Repair', 'Clean', 'Cook', 'Garden', 'Money', 'Health', 'Travel', 'Design', 'Code', 'Review', 'Read', 'Practice', 'Wait for reply', 'Quick win', 'Deep work', 'Needs a decision', 'Outside', 'Online', 'Phone', 'Waiting on someone else to finish their part', 'Heavy', 'Light', 'Fun', 'Family', 'Friends', 'Urgent-ish', 'Someday', 'Weekend', 'Evening', 'Paperwork', 'Tools', 'Shopping'];
const TITLES = ['Bins out Thursday', 'Read chapter 4', 'Footer link to old blog', 'Learn the bridge', 'History essay draft', 'Contact form sends twice', 'Mop the kitchen', 'Book boiler service', 'Renew passport before the Lisbon trip', 'Ask the landlord about the damp patch', 'Fix the gate latch', 'Hang hallway photos', 'Cookie banner text', 'Scan sketches', 'Order compost', 'Call the dentist', 'Compare three quotes for the new shed roof', 'Pay council tax', 'Reply to Sam', 'Write the release notes for v2', 'Sharpen the secateurs', 'Tidy the tool wall', 'Check tyre pressure', 'Back up the photo library', 'Draft the volunteer rota', 'Chapter 5 flashcards', 'Install the new bathroom fan', 'Email the accountant', 'Plant the bulbs'];
export function seedState() {
  const cats = CAT_NAMES.map((n, i) => ({ id: 'c' + i, name: n, color: COLORS[(i * 3) % COLORS.length] }));
  const projects = NAMES.map((name, i) => ({ id: 'p' + i, name, color: COLORS[i % COLORS.length], tasks: [] }));
  for (let k = 0; k < 66; k++) {
    const pi = k < 18 ? 0 : (k * 7 + 3) % projects.length;
    const nc = 1 + (k % 3);
    projects[pi].tasks.push({ id: 't' + k, title: TITLES[k % TITLES.length], status: k % 11 === 0 ? 'done' : 'next',
      categoryIds: Array.from({ length: nc }, (_, j) => cats[(k * 5 + j * 7) % cats.length].id), priority: null, updatedAt: 1 });
  }
  const now = Date.now();
  const inbox = [
    { id: 'cap1', text: 'Get three quotes for fixing the shed door', createdAt: now - 3 * 60e3 },
    { id: 'cap2', text: 'Look up evening pottery classes', createdAt: now - 26 * 3600e3 },
  ];
  return { projects, categories: cats, inbox, completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
}
