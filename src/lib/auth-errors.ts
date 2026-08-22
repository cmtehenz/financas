export function toPublicAuthError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message).toLowerCase()
      : "";

  if (
    message.includes("already exists") ||
    message.includes("already registered") ||
    message.includes("user already")
  ) {
    return "Este e-mail já está cadastrado.";
  }

  if (
    message.includes("invalid email or password") ||
    message.includes("invalid credentials") ||
    message.includes("invalid password")
  ) {
    return "E-mail ou senha inválidos.";
  }

  if (message.includes("too many") || message.includes("rate limit")) {
    return "Muitas tentativas. Aguarde um momento e tente de novo.";
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}
