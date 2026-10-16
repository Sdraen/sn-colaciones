import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
            <Section style={brandLogoFrame}>
              <Img
                src="https://www.sncolaciones.cl/brand/sn-colaciones-vintage-mark.png"
                width="72"
                height="72"
                alt="Logo SN Colaciones"
                style={brandLogo}
              />
            </Section>
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
  backgroundColor: "#f4e7cb",
  color: "#482712",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const container = {
  width: "100%",
  maxWidth: "600px",
  margin: "32px auto",
  overflow: "hidden",
  border: "1px solid #d9bd8d",
  borderRadius: "22px",
  backgroundColor: "#fffaf0",
};

const brandHeader = {
  padding: "28px 34px 24px",
  backgroundColor: "#b84b16",
  color: "#ffffff",
};

const brandLogoFrame = {
  display: "inline-block",
  margin: "0 0 14px",
  padding: "7px",
  borderRadius: "16px",
  backgroundColor: "#fffaf0",
};

const brandLogo = {
  display: "block",
  width: "72px",
  height: "72px",
  border: "0",
  outline: "none",
  textDecoration: "none",
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
  color: "#f7dfbe",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "1.2px",
  lineHeight: "18px",
  textTransform: "uppercase" as const,
};

const content = { padding: "34px" };

const eyebrow = {
  margin: "0 0 10px",
  color: "#b84b16",
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "1.3px",
};

const heading = {
  margin: "0 0 22px",
  color: "#482712",
  fontSize: "28px",
  fontWeight: "800",
  letterSpacing: "-0.5px",
  lineHeight: "34px",
};

const greeting = {
  margin: "0 0 8px",
  color: "#482712",
  fontSize: "15px",
  fontWeight: "700",
  lineHeight: "24px",
};

const messageText = {
  margin: "0 0 24px",
  color: "#765d49",
  fontSize: "16px",
  lineHeight: "26px",
};

const button = {
  display: "inline-block",
  padding: "13px 20px",
  borderRadius: "12px",
  backgroundColor: "#b84b16",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "800",
  lineHeight: "20px",
  textDecoration: "none",
};

const noticeBox = {
  marginTop: "28px",
  padding: "16px 18px",
  border: "1px solid #d9bd8d",
  borderRadius: "14px",
  backgroundColor: "#f7e8ca",
};

const noticeTitle = {
  margin: "0 0 4px",
  color: "#66733b",
  fontSize: "13px",
  fontWeight: "800",
  lineHeight: "20px",
};

const noticeText = {
  margin: "0",
  color: "#765d49",
  fontSize: "12px",
  lineHeight: "19px",
};

const divider = { margin: "28px 0 18px", borderColor: "#d9bd8d" };

const automaticText = {
  margin: "0",
  color: "#8a7466",
  fontSize: "12px",
  lineHeight: "19px",
};

const footer = {
  padding: "20px 34px 24px",
  backgroundColor: "#efe0c2",
  textAlign: "center" as const,
};

const footerBrand = {
  margin: "0",
  color: "#482712",
  fontSize: "13px",
  fontWeight: "800",
  lineHeight: "20px",
};

const footerText = {
  margin: "1px 0 0",
  color: "#765d49",
  fontSize: "11px",
  lineHeight: "18px",
};
