// Students pay the teacher's rate plus a 25% platform commission
export const CLASS_COMMISSION = 0.25;

export function studentClassPrice(teacherRate: number): number {
  return Math.round(teacherRate * (1 + CLASS_COMMISSION) * 100) / 100;
}
