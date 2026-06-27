const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatJapaneseDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${JP_WEEKDAYS[date.getDay()]}曜日`;
}

export function formatHistoryDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日（${JP_WEEKDAYS[date.getDay()]}）`;
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDate(date, today)) return "今日";
  if (isSameDate(date, yesterday)) return "昨日";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toJstDateInputValue(date = new Date()) {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDateInputValue(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getJstWeekStartInputValue(date = new Date()) {
  const today = toJstDateInputValue(date);
  const utcDate = new Date(`${today}T00:00:00Z`);
  const day = utcDate.getUTCDay() || 7;
  return addDaysToDateInputValue(today, -day + 1);
}

export function isFutureJstDateInput(value: string, date = new Date()) {
  return value > toJstDateInputValue(date);
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
