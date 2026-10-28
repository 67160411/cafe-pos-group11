// รับได้ทั้ง number และ string จาก query/params และต้องอยู่ในช่วง INT ของ MySQL
module.exports = function parseId(value) {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    value = Number(value);
  }

  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647
    ? value
    : null;
};
