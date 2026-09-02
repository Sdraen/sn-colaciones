import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

interface NotificationEmailProps {
  title: string;
  message: string;
  appUrl: string;
}

export function NotificationEmail({ title, message, appUrl }: NotificationEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{title} · SN Colaciones</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandHeader}>
            <Text style={brandMark}>SN</Text>
            <Text style={brandName}>SN Colaciones</Text>
            <Text style={brandCaption}>Cocina casera · Gestión diaria</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>NOTIFICACIÓN DEL SISTEMA</Text>
            <Heading as="h1" style={heading}>{title}</Heading>
            <Text style={greeting}>Hola,</Text>
            <Text style={messageText}>{message}</Text>
            <Button href={appUrl} style={button}>Revisar en SN Colaciones</Button>

            <Section style={noticeBox}>
              <Text style={noticeTitle}>Información importante</Text>
              <Text style={noticeText}>
                Ingresa siempre desde el sitio oficial. SN Colaciones nunca solicitará tu contraseña por correo.
              </Text>
            </Section>

            <Hr style={divider} />
            <Text style={automaticText}>
              Este es un mensaje automático relacionado con la gestión de colaciones de tu organización.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerBrand}>SN Colaciones</Text>
            <Text style={footerText}>Concepción, Chile</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: "0",
  backgroundColor: "#fff6e5",
  color: "#3b2418",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const container = {
  width: "100%",
  maxWidth: "600px",
  margin: "32px auto",
  overflow: "hidden",
  border: "1px solid #ead1ad",
  borderRadius: "22px",
  backgroundColor: "#fffdf8",
};

const brandHeader = {
  padding: "28px 34px 24px",
  backgroundColor: "#d84b2a",
  color: "#ffffff",
};

const brandMark = {
  display: "inline-block",
  width: "42px",
  margin: "0 0 14px",
  borderRadius: "12px",
  backgroundColor: "#efa51f",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "800",
  lineHeight: "42px",
  textAlign: "center" as const,
};

const brandName = {
  margin: "0",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "800",
  lineHeight: "28px",
};

const brandCaption = {
  margin: "2px 0 0",
  color: "#ffe9dd",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "1.2px",
  lineHeight: "18px",
  textTransform: "uppercase" as const,
};

const content = { padding: "34px" };

const eyebrow = {
  margin: "0 0 10px",
  color: "#d84b2a",
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "1.3px",
};

const heading = {
  margin: "0 0 22px",
  color: "#3b2418",
  fontSize: "28px",
  fontWeight: "800",
  letterSpacing: "-0.5px",
  lineHeight: "34px",
};

const greeting = {
  margin: "0 0 8px",
  color: "#3b2418",
  fontSize: "15px",
  fontWeight: "700",
  lineHeight: "24px",
};

const messageText = {
  margin: "0 0 24px",
  color: "#654d3e",
  fontSize: "16px",
  lineHeight: "26px",
};

const button = {
  display: "inline-block",
  padding: "13px 20px",
  borderRadius: "12px",
  backgroundColor: "#d84b2a",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "800",
  lineHeight: "20px",
  textDecoration: "none",
};

const noticeBox = {
  marginTop: "28px",
  padding: "16px 18px",
  border: "1px solid #ead1ad",
  borderRadius: "14px",
  backgroundColor: "#fff6e5",
};

const noticeTitle = {
  margin: "0 0 4px",
  color: "#3f7b48",
  fontSize: "13px",
  fontWeight: "800",
  lineHeight: "20px",
};

const noticeText = {
  margin: "0",
  color: "#786153",
  fontSize: "12px",
  lineHeight: "19px",
};

const divider = { margin: "28px 0 18px", borderColor: "#ead1ad" };

const automaticText = {
  margin: "0",
  color: "#8a7466",
  fontSize: "12px",
  lineHeight: "19px",
};

const footer = {
  padding: "20px 34px 24px",
  backgroundColor: "#f8ead4",
  textAlign: "center" as const,
};

const footerBrand = {
  margin: "0",
  color: "#3b2418",
  fontSize: "13px",
  fontWeight: "800",
  lineHeight: "20px",
};

const footerText = {
  margin: "1px 0 0",
  color: "#786153",
  fontSize: "11px",
  lineHeight: "18px",
};
