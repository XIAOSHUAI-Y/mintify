import type { TransactionMood } from '../types';

export interface MoodMeta {
  value: TransactionMood;
  label: string;
  emoji: string;
  description: string;
}

/** 顺序即表单展示顺序；后悔放最后，避免新用户以为必须选负面的才准确。 */
export const MOOD_OPTIONS: MoodMeta[] = [
  { value: 'necessary', label: '必要', emoji: '🧾', description: '该花的钱' },
  { value: 'happy', label: '开心', emoji: '😄', description: '花得值' },
  { value: 'regret', label: '后悔', emoji: '😞', description: '冲动了' },
];

export function getMoodMeta(mood: TransactionMood): MoodMeta {
  return MOOD_OPTIONS.find((option) => option.value === mood) ?? MOOD_OPTIONS[0];
}
