import { z } from "zod";

/**
 * URL фото: допускаем http/https. Пустая строка → undefined.
 * Используем transform, чтобы удобно принимать формы.
 */
const optionalUrlSchema = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional()
  .refine(
    (val) => {
      if (val === undefined) return true;
      try {
        const u = new URL(val);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Некорректный URL (ожидается http/https)" }
  );

/**
 * Создание зала (POST /api/halls).
 */
export const createHallSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Название минимум 2 символа")
    .max(100, "Название слишком длинное"),
  description: z
    .string()
    .trim()
    .max(1000, "Описание слишком длинное")
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  photoUrl: optionalUrlSchema
});

export type CreateHallInput = z.infer<typeof createHallSchema>;

/**
 * Обновление зала (PATCH /api/halls/[id]).
 * Все поля опциональны, но хотя бы одно должно быть передано.
 */
export const updateHallSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Название минимум 2 символа")
      .max(100, "Название слишком длинное")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Описание слишком длинное")
      .transform((val) => (val === "" ? undefined : val))
      .nullable()
      .optional(),
    photoUrl: optionalUrlSchema.nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Не передано ни одного поля для обновления"
  });

export type UpdateHallInput = z.infer<typeof updateHallSchema>;