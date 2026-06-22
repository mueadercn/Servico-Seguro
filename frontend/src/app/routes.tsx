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
import { NotFound } from "./pages/NotFound";

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
]);
