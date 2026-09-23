export const XP_PER_TASK = 20;
export function createState() {
  return { version: 1, currentDay: 0, rewardClaimed: false, days: Array.from({ length: 7 }, () => Array.from({ length: 3 }, () => ({ text: '', done: false }))) };
}
export function stats(s) {
  const totalDone = s.days.flat().filter(t => t.done).length;
  const totalXp = totalDone * XP_PER_TASK;
  const completedDays = s.days.filter(day => day.every(t => t.done)).length;
  return { totalDone, totalXp, level: Math.floor(totalXp / 100) + 1, xp: totalXp % 100, completedDays, canClaim: completedDays === 7 && !s.rewardClaimed };
}
export function setTaskDone(s, day, task, done) {
  const t = s.days[day]?.[task];
  if (!t || (done && !t.text.trim())) return false;
  t.done = done;
  return true;
}
export function advanceDay(s) {
  if (s.currentDay >= 6 || !s.days[s.currentDay].every(t => t.done)) return false;
  s.currentDay++;
  return true;
}
export function validateState(s) {
  const invalid = () => { throw new Error('存档格式不正确或版本不兼容'); };
  if (!s || s.version !== 1 || !Number.isInteger(s.currentDay) || s.currentDay < 0 || s.currentDay > 6 || typeof s.rewardClaimed !== 'boolean' || !Array.isArray(s.days) || s.days.length !== 7) invalid();
  for (const day of s.days) {
    if (!Array.isArray(day) || day.length !== 3) invalid();
    for (const t of day) if (!t || typeof t.text !== 'string' || t.text.length > 160 || typeof t.done !== 'boolean' || (t.done && !t.text.trim())) invalid();
  }
  return { version: 1, currentDay: s.currentDay, rewardClaimed: s.rewardClaimed, days: s.days.map(d => d.map(t => ({ text: t.text, done: t.done }))) };
}
