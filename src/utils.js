/**
  * @param { unknown } condition
  * @param { String } message
  */
export const assert = (condition, message) => {
	if (!condition) throw new Error(message)
}

export const TO_RAD = 1 / 180 * Math.PI;
export const TO_DEG = 1 * 180 / Math.PI;
