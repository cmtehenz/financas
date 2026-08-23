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
    return "Este e-mail já está cadastrado. Entre com a senha ou use outro e-mail.";
  }

  if (message.includes("failed to create user") || message.includes("failed to create session")) {
    return "Não foi possível criar a conta. Tente novamente em instantes.";
  }

  if (
    message.includes("invalid email or password") ||
    message.includes("invalid credentials") ||
    message.includes("invalid password") ||
    message.includes("user not found")
  ) {
    return "E-mail ou senha inválidos.";
  }

  if (message.includes("too many") || message.includes("rate limit")) {
    return "Muitas tentativas. Aguarde um momento e tente de novo.";
  }

  if (
    message.includes("invalid origin") ||
    message.includes("trusted origin") ||
    message.includes("invalid callback")
  ) {
    return "O endereço do site não está autorizado para login. Confira BETTER_AUTH_URL na Vercel.";
  }

  if (
    message.includes("database_url") ||
    message.includes("better_auth_secret") ||
    message.includes("missing required environment")
  ) {
    return "O ambiente de produção está incompleto. Confira DATABASE_URL e BETTER_AUTH_SECRET na Vercel.";
  }

  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection terminated") ||
    message.includes("websocket") ||
    message.includes("connect timeout")
  ) {
    return "Não foi possível conectar ao banco agora. Tente novamente em instantes.";
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}
