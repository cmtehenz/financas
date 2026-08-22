import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(128, "A senha é longa demais.");

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80, "O nome é longo demais."),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const requestPasswordResetSchema = z.object({
  email,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
