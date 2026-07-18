import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Busca } from "./pages/Busca";
import { ComoFunciona } from "./pages/ComoFunciona";
import { ClientDashboard } from "./pages/ClientDashboard";
import { ProviderDashboard } from "./pages/ProviderDashboard";
import { Orcamento } from "./pages/Orcamento";
import { Contrato } from "./pages/Contrato";
import { Biometria } from "./pages/Biometria";
import { Admin } from "./pages/Admin";
import { Chat } from "./pages/Chat";
import { Avaliar } from "./pages/Avaliar";
import { ProviderProfile } from "./pages/ProviderProfile"
import { Profissionais } from "./pages/Profissionais";
import { Contato as ContatoPage } from "./pages/Contato";
import { NotFound } from "./pages/NotFound";
import { BlindadoLayout } from "./pages/blindado/BlindadoLayout";
import { BlindadoLanding } from "./pages/blindado/BlindadoLanding";
import { BlindadoDashboard } from "./pages/blindado/BlindadoDashboard";
import { BlindadoNovo } from "./pages/blindado/BlindadoNovo";
import { BlindadoCreditos } from "./pages/blindado/BlindadoCreditos";
import { BlindadoContrato } from "./pages/blindado/BlindadoContrato";
import { BlindadoAcesso } from "./pages/blindado/BlindadoAcesso";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "auth", Component: Auth },
      { path: "busca", Component: Busca },
      { path: "como-funciona", Component: ComoFunciona },
      { path: "contratante/*", Component: ClientDashboard },
      { path: "prestador/*", Component: ProviderDashboard },
      { path: "perfil/:id", Component: ProviderProfile },
      { path: "profissionais", Component: Profissionais },
      { path: "contato", Component: ContatoPage },
      { path: "orcamento", Component: Orcamento },
      { path: "contrato", Component: Contrato },
      { path: "biometria", Component: Biometria },
      { path: "admin", Component: Admin },
      { path: "admin/*", Component: Admin },
      { path: "chat/:token", Component: Chat },
      { path: "avaliar/:token", Component: Avaliar },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/blindado",
    Component: BlindadoLayout,
    children: [
      { index: true, Component: BlindadoLanding },
      { path: "painel", Component: BlindadoDashboard },
      { path: "novo", Component: BlindadoNovo },
      { path: "novo/:id", Component: BlindadoNovo },
      { path: "creditos", Component: BlindadoCreditos },
      { path: "c/:token", Component: BlindadoContrato },
      { path: "acesso", Component: BlindadoAcesso },
    ],
  },
]);
