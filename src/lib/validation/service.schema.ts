import { z } from "zod";

/**
 * Создание услуги (POST /api/services).
 */
export const createServiceSchema = z.object({
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
  price: z
    .number({
      required_error: "Укажите цену",
      invalid_type_error: "Цена должна быть числом"
    })
    .positive("Цена должна быть положительной")
    .finite("Цена должна быть конечным числом"),
  durationMin: z
    .number({
      required_error: "Укажите длительность",
      invalid_type_error: "Длительность должна быть числом"
    })
    .int("Длительность — целое число минут")
    .positive("Длительность должна быть положительной")
    .max(1440, "Длительность не может превышать 1440 минут (24 часа)"),
  hallId: z.string().min(1, "Не выбран зал")
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Обновление услуги (PATCH /api/services/[id]).
 * Все поля опциональны, но хотя бы одно должно быть передано.
 */
export const updateServiceSchema = z
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
    price: z
      .number({
        invalid_type_error: "Цена должна быть числом"
      })
      .positive("Цена должна быть положительной")
      .finite("Цена должна быть конечным числом")
      .optional(),
    durationMin: z
      .number({
        invalid_type_error: "Длительность должна быть числом"
      })
      .int("Длительность — целое число минут")
      .positive("Длительность должна быть положительной")
      .max(1440, "Длительность не может превышать 1440 минут (24 часа)")
      .optional(),
    hallId: z.string().min(1, "Не выбран зал").optional(),
    isActive: z.boolean().optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Не передано ни одного поля для обновления"
  });

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Запрос списка услуг (query GET /api/services?hallId=…&includeInactive=…).
 */
export const servicesQuerySchema = z.object({
  hallId: z.string().min(1).optional(),
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((val) => val === "true" || val === true)
});

export type ServicesQuery = z.infer<typeof servicesQuerySchema>;