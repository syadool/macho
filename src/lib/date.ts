const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

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

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
