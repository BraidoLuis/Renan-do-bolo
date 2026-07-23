"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Screen = "Visão geral" | "Pedidos" | "Orçamentos" | "Produção" | "Cardápio" | "Estoque" | "Clientes" | "Financeiro" | "Relatórios" | "Configurações";
type Role = "admin" | "client";
type UserProfile = {
  full_name: string;
  role: Role;
};
type Product = {
  id: string | number;
  name: string;
  category: string;
  price: string;
  description: string;
  image: string;
  active: boolean;
  archived: boolean;
  preparation: string;
  minimum: string;
  featured: boolean;
  featuredOrder: number;
  stock: number;
  lowStock: number;
  customizable: boolean;
  options: string[];
};
type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  description: string | null;
  image_url: string | null;
  preparation_time: string | null;
  minimum_order: string | null;
  stock_quantity: number;
  low_stock_limit: number;
  is_active: boolean;
  is_archived: boolean;
  is_featured: boolean;
  featured_order: number | null;
  is_customizable: boolean;

  product_options?: {
    option_name: string;
  }[];
};

type CartItem = { product: Product; quantity: number };
type Quote = { id: string; client: string; item: string; details: string; value: string; status: string; date: string };

function priceNumber(price: string) { return Number(price.replace(/[^\d,]/g, "").replace(",", ".")) || 0 }
function databasePrice(value: string) {
  const sanitized = value
    .replace(/[^\d,.]/g, "")
    .trim();

  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;

  return Number(normalized);
}
function money(value: number) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function getFirstName(fullName: string) {
  return fullName.trim().split(" ")[0] || "Usuário";
}

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(name => name[0]?.toUpperCase())
    .join("");
}
function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: money(Number(row.price)),
    description: row.description || "",
    image: row.image_url || "",
    active: row.is_active,
    archived: row.is_archived,
    preparation: row.preparation_time || "",
    minimum: row.minimum_order || "",
    featured: row.is_featured,
    featuredOrder: row.featured_order || 0,
    stock: row.stock_quantity,
    lowStock: row.low_stock_limit,
    customizable: row.is_customizable,
    options: Array.from(
      new Set(
        (row.product_options || []).map(
          option => option.option_name
        )
      )
    ),
  };
}

const nav: { label: Screen; icon: string }[] = [
  { label: "Visão geral", icon: "⌂" },
  { label: "Pedidos", icon: "▢" },
  { label: "Orçamentos", icon: "◇" },
  { label: "Produção", icon: "♨" },
  { label: "Cardápio", icon: "▤" },
  { label: "Estoque", icon: "▦" },
  { label: "Clientes", icon: "♙" },
  { label: "Financeiro", icon: "$" },
  { label: "Relatórios", icon: "▥" },
  { label: "Configurações", icon: "⚙" },
];

const orders = [
  { id: "#1048", client: "Ana Ribeiro", initials: "AR", item: "Bolo Red Velvet", time: "10:30", date: "Hoje", value: "R$ 320,00", status: "Em produção" },
  { id: "#1049", client: "Carlos Mendes", initials: "CM", item: "Kit Festa 30 pessoas", time: "12:00", date: "Hoje", value: "R$ 485,00", status: "Confirmado" },
  { id: "#1050", client: "Beatriz Lima", initials: "BL", item: "Torta de Limão", time: "14:30", date: "Hoje", value: "R$ 148,00", status: "Aguardando" },
  { id: "#1051", client: "Mariana Costa", initials: "MC", item: "50 Brigadeiros gourmet", time: "16:00", date: "Hoje", value: "R$ 225,00", status: "Confirmado" },
  { id: "#1052", client: "Paulo Nunes", initials: "PN", item: "Bolo de casamento", time: "09:00", date: "Amanhã", value: "R$ 890,00", status: "Pendente" },
];

const initialQuotes: Quote[] = [
  { id: "ORC-204", client: "Ana Ribeiro", item: "Bolo de aniversário personalizado", details: "Tema floral, 40 pessoas, recheio de ninho com morango.", value: "R$ 420,00", status: "Aguardando cliente", date: "30 jul" },
  { id: "ORC-205", client: "Carlos Mendes", item: "Mesa de doces", details: "200 doces variados e montagem no local.", value: "R$ 780,00", status: "Em análise", date: "02 ago" }
];

const clients = [
  { name: "Ana Ribeiro", email: "ana.ribeiro@email.com", orders: 8, spent: "R$ 1.840", initials: "AR" },
  { name: "Carlos Mendes", email: "carlos@email.com", orders: 5, spent: "R$ 1.225", initials: "CM" },
  { name: "Beatriz Lima", email: "bia.lima@email.com", orders: 11, spent: "R$ 2.460", initials: "BL" },
  { name: "Mariana Costa", email: "mariana@email.com", orders: 4, spent: "R$ 890", initials: "MC" },
];

function Status({ children }: { children: string }) {
  const cls = children.toLowerCase().replace(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return <span className={`status ${cls}`}><i />{children}</span>;
}

export default function Home() {
  const [role, setRole] =
    useState<Role | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [screen, setScreen] =
    useState<Screen>("Visão geral");

  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState("");

  const [mobileNav, setMobileNav] =
    useState(false);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [appOrders, setAppOrders] =
    useState(orders);

  const [quotes, setQuotes] =
    useState<Quote[]>(initialQuotes);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [notifications, setNotifications] =
    useState([
      "Novo pedido de orçamento recebido",
      "Estoque baixo: Torta de Limão",
      "Ana solicitou reagendamento do pedido #1048",
    ]);

  /*
   * Recupera a sessão do Supabase quando
   * o usuário atualiza ou reabre a página.
   */
  useEffect(() => {
    let componentActive = true;

    async function restoreSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!componentActive) {
          return;
        }

        if (sessionError) {
          console.error(
            "Erro ao recuperar sessão:",
            sessionError
          );

          setRole(null);
          setProfile(null);
          return;
        }

        if (!session?.user) {
          setRole(null);
          setProfile(null);
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single();

        if (!componentActive) {
          return;
        }

        if (profileError || !profile) {
          console.error(
            "Erro ao recuperar perfil:",
            profileError
          );

          await supabase.auth.signOut();
          setRole(null);
          setProfile(null);
          return;
        }

        if (
          profile.role !== "admin" &&
          profile.role !== "client"
        ) {
          await supabase.auth.signOut();
          setRole(null);
          setProfile(null);
          return;
        }

        setRole(profile.role as Role);
        setProfile(profile as UserProfile);
      } catch (connectionError) {
        console.error(
          "Erro ao restaurar a sessão:",
          connectionError
        );

        setRole(null);
        setProfile(null);
      } finally {
        if (componentActive) {
          setAuthLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      componentActive = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !role) {
      return;
    }

    let componentActive = true;

    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          category,
          price,
          description,
          image_url,
          preparation_time,
          minimum_order,
          stock_quantity,
          low_stock_limit,
          is_active,
          is_archived,
          is_featured,
          featured_order,
          is_customizable,
          product_options (
            option_name
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (!componentActive) {
        return;
      }

      if (error) {
        console.error(
          "Erro ao carregar produtos:",
          error
        );

        setToast(
          "Não foi possível carregar os produtos."
        );

        setTimeout(() => {
          setToast("");
        }, 2800);

        return;
      }

      const productRows = (data || []) as ProductRow[];

      setProducts(
        productRows.map(mapProduct)
      );
    }

    loadProducts();

    return () => {
      componentActive = false;
    };
  }, [authLoading, role]);

  const filteredOrders = useMemo(
    () =>
      appOrders.filter(order =>
        `${order.client} ${order.item} ${order.id}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [query, appOrders]
  );

  function saveOrder(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setModal(false);
    setToast("Pedido cadastrado com sucesso!");

    setTimeout(() => {
      setToast("");
    }, 2800);
  }

  async function handleLogout() {
  
    sessionStorage.removeItem(
      "doce-gestao-client-section"
    );
    
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      console.error(
        "Erro ao sair da conta:",
        logoutError
      );

      setToast(
        "Não foi possível sair da conta. Tente novamente."
      );

      setTimeout(() => {
        setToast("");
      }, 2800);

      return;
    }

    setRole(null);
    setProfile(null);
    setScreen("Visão geral");
  }

  /*
   * Enquanto o Supabase verifica a sessão,
   * não mostra o login nem os painéis.
   */
  if (authLoading) {
    return (
      <main className="account-created">
        <section>
          <span>♨</span>

          <p className="eyebrow">
            DOCE GESTÃO
          </p>

          <h1>Carregando sua conta...</h1>

          <p>
            Estamos verificando sua sessão com
            segurança.
          </p>
        </section>
      </main>
    );
  }

  /*
   * Sem usuário autenticado, mostra o login.
   */
  if (!role) {
    return (
      <Login
        onLogin={userProfile => {
          setProfile(userProfile);
          setRole(userProfile.role);
        }}
      />
    );
  }

  /*
   * Usuário com role client.
   */
  if (role === "client") {
    return (
      <ClientPortal
        userName={profile?.full_name || "Cliente"}
        products={products.filter(
          product => !product.archived
        )}
        orders={appOrders}
        quotes={quotes}
        onQuote={(id, status) => {
          setQuotes(current =>
            current.map(quote =>
              quote.id === id
                ? {
                    ...quote,
                    status,
                  }
                : quote
            )
          );

          setNotifications(current => [
            `Cliente respondeu ao orçamento ${id}`,
            ...current,
          ]);
        }}
        onOrderRequest={(id, request) => {
          setAppOrders(current =>
            current.map(order =>
              order.id === id
                ? {
                    ...order,
                    request,
                  }
                : order
            )
          );

          setNotifications(current => [
            `Nova solicitação no pedido ${id}: ${request}`,
            ...current,
          ]);
        }}
        onLogout={handleLogout}
      />
    );
  }

  /*
   * Usuário com role admin.
   */
  return (
    <main className="app-shell">
      <aside
        className={`sidebar ${
          mobileNav ? "open" : ""
        }`}
      >
        <button
          className="close-menu"
          onClick={() => setMobileNav(false)}
          aria-label="Fechar menu"
        >
          ×
        </button>

        <div className="brand">
          <span className="cake">♨</span>

          <strong>
            Doce
            <br />
            <em>Gestão</em>
          </strong>
        </div>

        <div className="ornament">
          <span />
          ✤
          <span />
        </div>

        <nav>
          {nav.map(item => (
            <button
              key={item.label}
              className={
                screen === item.label
                  ? "active"
                  : ""
              }
              onClick={() => {
                setScreen(item.label);
                setMobileNav(false);
              }}
            >
              <b>{item.icon}</b>
              {item.label}
            </button>
          ))}
        </nav>

        <button
          className="new-order side"
          onClick={() => setModal(true)}
        >
          <span>＋</span>
          Novo pedido
        </button>

        <div className="side-art" />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="menu"
            onClick={() => setMobileNav(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <div>
            <p className="eyebrow">
              QUINTA-FEIRA, 23 DE JULHO
            </p>

            <h1>
              {screen === "Visão geral"
                ? `Bom dia, ${getFirstName(
                  profile?.full_name || "Administrador"
                )}`
                : screen}
            </h1>

            <p>
              {screen === "Visão geral"
                ? "Aqui está o resumo da sua confeitaria hoje."
                : `Gerencie ${screen.toLowerCase()} da sua confeitaria.`}
            </p>
          </div>

          <div className="header-actions">
            <label className="search">
              <span>⌕</span>

              <input
                value={query}
                onChange={e =>
                  setQuery(e.target.value)
                }
                placeholder="Buscar..."
              />
            </label>

            <button
              className="bell"
              aria-label="Notificações"
              onClick={() =>
                setNotificationsOpen(value => !value)
              }
            >
              ♧
              <i />
            </button>

            <div className="avatar">
              {getInitials(
                profile?.full_name || "Administrador"
              )}
            </div>

            <button
              className="user user-button"
              onClick={handleLogout}
              title="Sair da conta"
            >
              <strong>
                {profile?.full_name || "Administrador"}
              </strong>

              <small>
                Administradora • Sair
              </small>
            </button>
          </div>
        </header>

        {screen === "Visão geral" && (
          <Dashboard
            setScreen={setScreen}
            openModal={() => setModal(true)}
            orders={filteredOrders.slice(0, 3)}
          />
        )}

        {screen === "Pedidos" && (
          <Orders
            orders={filteredOrders}
            openModal={() => setModal(true)}
            onStatus={(id, status) => {
              setAppOrders(current =>
                current.map(order =>
                  order.id === id
                    ? {
                        ...order,
                        status,
                      }
                    : order
                )
              );

              setToast(
                `Status do pedido ${id} atualizado!`
              );

              setTimeout(() => {
                setToast("");
              }, 2800);
            }}
          />
        )}

        {screen === "Orçamentos" && (
          <AdminQuotes
            quotes={quotes}
            onUpdate={(id, value, status) => {
              setQuotes(current =>
                current.map(quote =>
                  quote.id === id
                    ? {
                        ...quote,
                        value,
                        status,
                      }
                    : quote
                )
              );

              setNotifications(current => [
                `Orçamento ${id} atualizado`,
                ...current,
              ]);
            }}
          />
        )}

        {screen === "Produção" && (
          <Production />
        )}

        {screen === "Cardápio" && (
          <Catalog
            products={products}
            onChange={setProducts}
            onToast={message => {
              setToast(message);

              setTimeout(() => {
                setToast("");
              }, 2800);
            }}
          />
        )}

        {screen === "Estoque" && (
          <Inventory
            products={products.filter(
              product => !product.archived
            )}
            onStock={(id, stock) => {
              setProducts(current =>
                current.map(product =>
                  product.id === id
                    ? {
                        ...product,
                        stock,
                      }
                    : product
                )
              );
            }}
          />
        )}

        {screen === "Clientes" && (
          <Clients />
        )}

        {screen === "Financeiro" && (
          <Finance />
        )}

        {screen === "Relatórios" && (
          <Reports />
        )}

        {screen === "Configurações" && (
          <Settings />
        )}
      </section>

      {notificationsOpen && (
        <NotificationPanel
          items={notifications}
          onClose={() =>
            setNotificationsOpen(false)
          }
          onRead={() => setNotifications([])}
        />
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={event => {
            if (
              event.currentTarget === event.target
            ) {
              setModal(false);
            }
          }}
        >
          <form
            className="modal"
            onSubmit={saveOrder}
          >
            <div className="modal-title">
              <div>
                <p>NOVO PEDIDO</p>
                <h2>Adicionar encomenda</h2>
              </div>

              <button
                type="button"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              <label>
                Cliente

                <input
                  required
                  placeholder="Nome do cliente"
                />
              </label>

              <label>
                Telefone

                <input
                  required
                  placeholder="(22) 99999-9999"
                />
              </label>

              <label className="wide">
                Produto

                <select>
                  <option>
                    Bolo Red Velvet
                  </option>

                  <option>
                    Torta de Limão
                  </option>

                  <option>
                    Kit Festa 30 pessoas
                  </option>

                  <option>
                    Pedido personalizado
                  </option>
                </select>
              </label>

              <label>
                Data da entrega
                <input required type="date" />
              </label>

              <label>
                Horário
                <input required type="time" />
              </label>

              <label>
                Valor
                <input
                  required
                  placeholder="R$ 0,00"
                />
              </label>

              <label>
                Status

                <select>
                  <option>Aguardando</option>
                  <option>Confirmado</option>
                  <option>Em produção</option>
                </select>
              </label>

              <label className="wide">
                Observações

                <textarea
                  placeholder="Detalhes, decoração, sabor, restrições..."
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>

              <button className="primary">
                Salvar pedido
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}

function Login({
  onLogin,
}: {
  onLogin: (profile: UserProfile) => void;
}) {
  const [role, setRole] = useState<Role>("admin");
  const [showPassword, setShowPassword] =
    useState(false);
  const [signup, setSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();

    const password = String(
      data.get("password") || ""
    );

    if (!email || !password) {
      setError("Informe o e-mail e a senha.");
      setLoading(false);
      return;
    }

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error(
          "Erro de autenticação:",
          authError
        );

        const message =
          authError.message.toLowerCase();

        if (message.includes("email not confirmed")) {
          setError(
            "Confirme seu e-mail antes de entrar."
          );
          return;
        }

        if (
          message.includes("invalid login credentials")
        ) {
          setError("E-mail ou senha incorretos.");
          return;
        }

        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError(
          "Não foi possível identificar o usuário."
        );
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error(
          "Erro ao carregar perfil:",
          profileError
        );

        await supabase.auth.signOut();

        setError(
          "Não foi possível carregar o perfil da conta."
        );
        return;
      }

      const profileRole = profile.role as Role;

      if (
        profileRole !== "admin" &&
        profileRole !== "client"
      ) {
        await supabase.auth.signOut();

        setError(
          "O tipo desta conta não é válido."
        );
        return;
      }

      if (profileRole !== role) {
        await supabase.auth.signOut();

        setError(
          profileRole === "client"
            ? "Conta não encontrada, tente novamente."
            : "Conta não encontrada, tente novamente."
        );

        return;
      }

      onLogin({
        full_name: profile.full_name,
        role: profileRole,
      });

    } catch (connectionError) {
      console.error(
        "Erro de conexão no login:",
        connectionError
      );

      setError(
        "Não foi possível conectar ao servidor. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  if (signup) {
    return (
      <Signup
        onBack={() => {
          setSignup(false);
          setRole("client");
          setError("");
        }}
      />
    );
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-brand">
          <span>♨</span>

          <strong>
            Doce <em>Gestão</em>
          </strong>
        </div>

        <div className="login-copy">
          <p>GESTÃO FEITA COM CARINHO</p>

          <h1>
            Mais tempo para criar.
            <br />
            Mais controle para crescer.
          </h1>

          <span>
            Organize pedidos, produção e clientes em
            um só lugar — com a delicadeza que sua
            confeitaria merece.
          </span>
        </div>

        <div className="login-quote">
          <b>“</b>

          <p>
            Minha rotina ficou muito mais organizada.
            Agora consigo focar no que amo: criar doces
            incríveis.
          </p>

          <small>
            Marina Borges • Doce Encanto
          </small>
        </div>

        <div className="login-rings" />
      </section>

      <section className="login-area">
        <form
          className="login-card"
          onSubmit={handleLogin}
        >
          <div className="mobile-brand">
            <span>♨</span>

            <strong>
              Doce <em>Gestão</em>
            </strong>
          </div>

          <p className="eyebrow">
            BEM-VINDO DE VOLTA
          </p>

          <h2>Acesse sua conta</h2>

          <p className="login-subtitle">
            Escolha seu tipo de acesso e informe seus
            dados.
          </p>

          <div
            className="role-switch"
            aria-label="Tipo de acesso"
          >
            <button
              type="button"
              className={
                role === "admin" ? "selected" : ""
              }
              onClick={() => {
                setRole("admin");
                setError("");
              }}
            >
              <span>♚</span>
              <b>Administrador</b>
              <small>Gestão completa</small>
            </button>

            <button
              type="button"
              className={
                role === "client" ? "selected" : ""
              }
              onClick={() => {
                setRole("client");
                setError("");
              }}
            >
              <span>♙</span>
              <b>Cliente</b>
              <small>Meus pedidos</small>
            </button>
          </div>

          <label className="login-label">
            E-mail

            <div className="login-input">
              <span>✉</span>

              <input
                required
                type="email"
                name="email"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="login-label">
            Senha

            <div className="login-input">
              <span>⌑</span>

              <input
                required
                type={
                  showPassword ? "text" : "password"
                }
                name="password"
                placeholder="Sua senha"
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(value => !value)
                }
                aria-label={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {showPassword ? "◉" : "◎"}
              </button>
            </div>
          </label>

          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked />
              Lembrar de mim
            </label>

            <button type="button">
              Esqueci minha senha
            </button>
          </div>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Entrando..."
              : `Entrar como ${
                  role === "admin"
                    ? "administrador"
                    : "cliente"
                }`}

            <span>→</span>
          </button>

          {role === "client" && (
            <p className="signup">
              Ainda não tem cadastro?{" "}

              <button
                type="button"
                onClick={() => setSignup(true)}
              >
                Criar minha conta
              </button>
            </p>
          )}
        </form>

        <footer>
          © 2026 Doce Gestão &nbsp;•&nbsp;
          Privacidade &nbsp;•&nbsp; Termos de uso
        </footer>
      </section>
    </main>
  );
}

function Signup({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] =
    useState("");

  async function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") || "").trim();

    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();

    const phone = String(data.get("phone") || "").trim();

    const birthDate = String(
      data.get("birth") || ""
    );

    const zip = String(data.get("zip") || "").trim();

    const street = String(
      data.get("street") || ""
    ).trim();

    const number = String(
      data.get("number") || ""
    ).trim();

    const complement = String(
      data.get("complement") || ""
    ).trim();

    const district = String(
      data.get("district") || ""
    ).trim();

    const city = String(data.get("city") || "").trim();

    const password = String(
      data.get("password") || ""
    );

    const confirmPassword = String(
      data.get("confirm") || ""
    );

    if (!name || !email || !phone || !birthDate) {
      setError("Preencha todos os dados pessoais.");
      setStep(1);
      return;
    }

    if (!zip || !street || !number || !district || !city) {
      setError(
        "Preencha os dados obrigatórios do endereço."
      );
      setStep(2);
      return;
    }

    if (password.length < 6) {
      setError(
        "A senha deve possuir pelo menos 6 caracteres."
      );
      setStep(3);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setStep(3);
      return;
    }

    setLoading(true);

    try {
      const {
        data: authData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone,
            birth_date: birthDate,

            address: {
              zip,
              street,
              number,
              complement,
              district,
              city,
            },
          },
        },
      });

      if (signUpError) {
        console.error(
          "Erro ao criar conta:",
          signUpError
        );

        if (
          signUpError.message
            .toLowerCase()
            .includes("already registered")
        ) {
          setError(
            "Já existe uma conta cadastrada com este e-mail."
          );
          return;
        }

        setError(signUpError.message);
        return;
      }

      if (!authData.user) {
        setError("Não foi possível criar a conta.");
        return;
      }

      setRegisteredEmail(email);
      setCreated(true);
    } catch (connectionError) {
      console.error(
        "Erro de conexão ao criar conta:",
        connectionError
      );

      setError(
        "Não foi possível conectar ao servidor. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <main className="account-created">
        <section>
          <span>✓</span>

          <p className="eyebrow">
            CADASTRO CONCLUÍDO
          </p>

          <h1>Sua conta foi criada!</h1>

          <p>
            Enviamos uma confirmação para{" "}
            <strong>{registeredEmail}</strong>.
            Verifique seu e-mail antes de entrar.
          </p>

          <button type="button" onClick={onBack}>
            Ir para o login
          </button>

          <small>
            Sua conta e seu perfil foram cadastrados
            com segurança.
          </small>
        </section>
      </main>
    );
  }

  return (
    <main className="create-account">
      <aside>
        <div className="login-brand">
          <span>♨</span>

          <strong>
            Doce <em>Gestão</em>
          </strong>
        </div>

        <div className="create-copy">
          <p>SEU ESPAÇO DOCE</p>

          <h1>
            Crie sua conta
            <br />
            em poucos passos.
          </h1>

          <span>
            Acompanhe pedidos, personalize produtos e
            torne cada comemoração ainda mais especial.
          </span>
        </div>

        <ol>
          <li className={step >= 1 ? "active" : ""}>
            <b>1</b>
            Dados pessoais
          </li>

          <li className={step >= 2 ? "active" : ""}>
            <b>2</b>
            Endereço
          </li>

          <li className={step >= 3 ? "active" : ""}>
            <b>3</b>
            Segurança
          </li>
        </ol>
      </aside>

      <section className="create-form-area">
        <button
          type="button"
          className="back-login"
          onClick={onBack}
        >
          ‹ Voltar para o login
        </button>

        <form onSubmit={submit}>
          <p className="eyebrow">CRIAR CONTA</p>

          <h2>
            {step === 1
              ? "Vamos começar"
              : step === 2
                ? "Onde entregamos?"
                : "Proteja sua conta"}
          </h2>

          <p>Etapa {step} de 3</p>

          {/* ETAPA 1 — DADOS PESSOAIS */}

          <div
            className={`account-step ${
              step === 1 ? "visible" : ""
            }`}
          >
            <label>
              Nome completo

              <input
                required={step === 1}
                name="name"
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            </label>

            <div className="field-row">
              <label>
                E-mail

                <input
                  required={step === 1}
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </label>

              <label>
                Telefone

                <input
                  required={step === 1}
                  name="phone"
                  placeholder="(22) 99999-9999"
                  autoComplete="tel"
                />
              </label>
            </div>

            <label>
              Data de nascimento

              <input
                required={step === 1}
                type="date"
                name="birth"
              />
            </label>

            <button
              type="button"
              className="next-step"
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Continuar →
            </button>
          </div>

          {/* ETAPA 2 — ENDEREÇO */}

          <div
            className={`account-step ${
              step === 2 ? "visible" : ""
            }`}
          >
            <label>
              CEP

              <input
                required={step === 2}
                name="zip"
                placeholder="00000-000"
                autoComplete="postal-code"
              />
            </label>

            <label>
              Rua

              <input
                required={step === 2}
                name="street"
                placeholder="Nome da rua"
                autoComplete="street-address"
              />
            </label>

            <div className="field-row">
              <label>
                Número

                <input
                  required={step === 2}
                  name="number"
                  placeholder="Número"
                />
              </label>

              <label>
                Complemento

                <input
                  name="complement"
                  placeholder="Apartamento, bloco..."
                />
              </label>
            </div>

            <div className="field-row">
              <label>
                Bairro

                <input
                  required={step === 2}
                  name="district"
                  placeholder="Bairro"
                />
              </label>

              <label>
                Cidade

                <input
                  required={step === 2}
                  name="city"
                  placeholder="Cidade"
                  autoComplete="address-level2"
                />
              </label>
            </div>

            <div className="step-buttons">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                Voltar
              </button>

              <button
                type="button"
                className="next-step"
                onClick={() => {
                  setError("");
                  setStep(3);
                }}
              >
                Continuar →
              </button>
            </div>
          </div>

          {/* ETAPA 3 — SEGURANÇA */}

          <div
            className={`account-step ${
              step === 3 ? "visible" : ""
            }`}
          >
            <label>
              Senha

              <input
                required={step === 3}
                minLength={6}
                type="password"
                name="password"
                placeholder="Mínimo de 6 caracteres"
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirmar senha

              <input
                required={step === 3}
                minLength={6}
                type="password"
                name="confirm"
                placeholder="Repita sua senha"
                autoComplete="new-password"
              />
            </label>

            <label className="accept-terms">
              <input
                required={step === 3}
                type="checkbox"
              />

              <span>
                Li e aceito os Termos de uso e a
                Política de privacidade.
              </span>
            </label>

            <div className="step-buttons">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
              >
                Voltar
              </button>

              <button
                type="submit"
                className="next-step"
                disabled={loading}
              >
                {loading
                  ? "Criando conta..."
                  : "Criar minha conta →"}
              </button>
            </div>
          </div>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}
        </form>

        <p className="has-account">
          Já possui uma conta?{" "}

          <button type="button" onClick={onBack}>
            Entrar
          </button>
        </p>
      </section>
    </main>
  );
}

type ClientSection =
  | "inicio"
  | "catalogo"
  | "pedidos"
  | "orcamentos"
  | "novo"
  | "pagamento"
  | "avaliacao"
  | "perfil"
  ;
function ClientPortal({ userName, products, orders, quotes, onQuote, onOrderRequest, onLogout }: {  userName: string; products: Product[]; orders: any[]; quotes: Quote[]; onQuote: (id: string, status: string) => void; onOrderRequest: (id: string, request: string) => void; onLogout: () => void }) {
  const [section, setSection] =
  useState<ClientSection>("inicio");

  const [
    sectionRestored,
    setSectionRestored,
  ] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [paid, setPaid] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [stars, setStars] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [purchasedItems, setPurchasedItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartToast, setCartToast] = useState("");
  const [requestOrder, setRequestOrder] = useState<string | null>(null);
  const currentStatus = orders[0]?.status || "Aguardando";
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    const savedSection =
      sessionStorage.getItem(
        "doce-gestao-client-section"
      ) as ClientSection | null;

    const validSections: ClientSection[] = [
      "inicio",
      "catalogo",
      "pedidos",
      "orcamentos",
      "novo",
      "pagamento",
      "avaliacao",
      "perfil",
    ];

    if (
      savedSection &&
      validSections.includes(savedSection)
    ) {
      setSection(savedSection);
    }

    setSectionRestored(true);
  }, []);

  useEffect(() => {
    if (!sectionRestored) {
      return;
    }

    sessionStorage.setItem(
      "doce-gestao-client-section",
      section
    );
  }, [section, sectionRestored]);
  function addToCart(product: Product) {
    setCart(current => current.some(item => item.product.id === product.id) ? current.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, quantity: 1 }]);
    setCartToast(`${product.name} adicionado ao carrinho`);
    setTimeout(() => setCartToast(""), 2200);
  }
  function changeQuantity(id: Product["id"], delta: number) { setCart(current => current.map(item => item.product.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0)) }
  return (
    <main className="client-portal">
      <header className="client-header">
        <div className="login-brand compact"><span>♨</span><strong>Doce <em>Gestão</em></strong></div>
        <nav>
          <button className={section === "inicio" ? "active" : ""} onClick={() => setSection("inicio")}>Início</button>
          <button className={section === "catalogo" ? "active" : ""} onClick={() => setSection("catalogo")}>Catálogo</button>
          <button className={section === "pedidos" ? "active" : ""} onClick={() => setSection("pedidos")}>Meus pedidos</button>
          <button className={section === "orcamentos" ? "active" : ""} onClick={() => setSection("orcamentos")}>Orçamentos</button>
          <button className={section === "pagamento" ? "active" : ""} onClick={() => setSection("pagamento")}>Pagamento</button>
          <button className={section === "avaliacao" ? "active" : ""} onClick={() => setSection("avaliacao")}>Avaliar</button>
        </nav>
        <div className="client-account">
          <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho com ${cartCount} itens`}><span>🛒</span><b>{cartCount}</b></button>
          <span className="initials">
            {getInitials(userName)}
          </span>
          <button onClick={() => setSection("perfil")}>
            {userName}
          </button>
          <button onClick={onLogout} className="logout">Sair</button>
        </div>
      </header>
      <section className="client-main">
        {section === "inicio" && <>
          <div className="client-welcome"><div><p className="eyebrow">OLÁ, {getFirstName(userName).toUpperCase()}</p><h1>Seus momentos doces,<br />sempre por perto.</h1><span>Acompanhe suas encomendas e fale com a confeitaria.</span></div><button onClick={() => setSection("novo")}>＋ Fazer nova encomenda</button></div>
          <div className="client-grid-main">
            <section className="panel current-order">
              <div className="client-panel-title"><div><span>🍰</span><div><small>PRÓXIMA ENCOMENDA</small><h2>Bolo Red Velvet</h2></div></div><Status>{currentStatus}</Status></div>
              <div className="order-detail-row"><div><small>Pedido</small><b>#1048</b></div><div><small>Entrega</small><b>Hoje, 10:30</b></div><div><small>Valor</small><b>R$ 320,00</b></div></div>
              <OrderTimeline status={currentStatus} paid={paid} />
              {!paid && <button className="pay-shortcut" onClick={() => setSection("pagamento")}>Realizar pagamento ›</button>}
            </section>
            <aside className="panel contact-card"><span>♡</span><h2>Precisa de ajuda?</h2><p>Fale diretamente com a confeitaria sobre seu pedido.</p><button>Conversar no WhatsApp</button><small>Atendimento: 8h às 18h</small></aside>
          </div>
          <div className="client-stats"><article><span>▢</span><div><b>8</b><small>Pedidos realizados</small></div></article><article><span>♡</span><div><b>3 anos</b><small>Com a gente</small></div></article><article><span>☆</span><div><b>240 pontos</b><small>Clube Doce</small></div></article></div>
        </>}
        {section === "pedidos" && <>
          <div className="client-page-title"><p className="eyebrow">HISTÓRICO</p><h1>Meus pedidos</h1><span>Acompanhe, reagende ou solicite o cancelamento.</span></div>
          <section className="panel client-orders">
            {orders.slice(0, 4).map((o, i) => (
              <article key={o.id}>
                <div className="product-mini">{["🍰", "🎂", "🥧", "🍫"][i]}</div>
                <div>
                  <small>{o.id} • {i === 0 ? "23 jul 2026" : "12 jun 2026"}</small>
                  <h3>{o.item}</h3>
                  <p>{o.request || (i === 0 ? "Entrega às 10:30" : "Pedido concluído")}</p>
                  {i === 0 && !o.request && <div className="order-request-actions"><button onClick={() => setRequestOrder(o.id)}>Reagendar</button><button onClick={() => onOrderRequest(o.id, "Cancelamento solicitado")}>Solicitar cancelamento</button></div>}
                </div>
                <div><Status>{o.request ? "Em análise" : i === 0 ? "Em produção" : "Pronto"}</Status><strong>{o.value}</strong></div>
              </article>
            ))}
          </section>
        </>}
        {section === "orcamentos" && <ClientQuotes quotes={quotes.filter(q => q.client === userName)} onAnswer={onQuote} />}
        {section === "catalogo" && <ClientCatalog products={products.filter(p => p.active)} onChoose={p => { setSelectedProduct(p); setSection("novo") }} onAdd={addToCart} />}
        {section === "novo" && <>
          <div className="client-page-title"><p className="eyebrow">NOVA ENCOMENDA</p><h1>Conte seu desejo doce</h1><span>Personalize os detalhes e solicite seu orçamento.</span></div>
          {selectedProduct && <div className="selected-product"><ProductVisual product={selectedProduct} /><div><small>PRODUTO SELECIONADO</small><b>{selectedProduct.name}</b><span>A partir de {selectedProduct.price}</span></div><button onClick={() => setSelectedProduct(null)}>Trocar</button></div>}
          <form className="panel client-form" onSubmit={e => { e.preventDefault(); setSent(true) }}>
            <div className="form-grid">
              <label>Tipo de produto<select key={selectedProduct?.id || "custom"} defaultValue={selectedProduct?.name || ""}><option value="">Pedido personalizado</option>{products.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}</select></label>
              <label>Quantidade de pessoas<input type="number" placeholder="Ex.: 30" /></label>
              {selectedProduct?.customizable && selectedProduct.options.map(option => <label key={option}>{option}<select><option>Escolha uma opção</option><option>{option === "Tamanho" ? "Pequeno" : "Tradicional"}</option><option>{option === "Tamanho" ? "Médio" : "Especial"}</option><option>{option === "Tamanho" ? "Grande" : "Premium"}</option></select></label>)}
              <label>Data desejada<input required type="date" /></label>
              <label>Horário preferido<input required type="time" /></label>
              <label className="wide">Tema, sabores e detalhes<textarea required placeholder="Conte como você imagina sua encomenda..." /></label>
              <label className="wide">Imagem de referência<input type="file" accept="image/*" /></label>
            </div>
            <button className="primary">Solicitar orçamento</button>
            {sent && <span className="form-success">✓ Solicitação enviada! Entraremos em contato em breve.</span>}
          </form>
        </>}
        {section === "pagamento" && <Payment paid={paid} cart={paid ? purchasedItems : cart} onPay={() => { setPurchasedItems(cart); setPaid(true); setCart([]) }} />}
        {section === "avaliacao" && <Review reviewed={reviewed} stars={stars} setStars={setStars} onSubmit={() => setReviewed(true)} />}
        {section === "perfil" && <>
          <div className="client-page-title"><p className="eyebrow">MINHA CONTA</p><h1>Dados pessoais</h1></div>
          <section className="panel settings"><div className="form-grid"><label>Nome<input defaultValue={userName} /></label><label>Telefone<input defaultValue="(22) 99987-6543" /></label><label>E-mail<input defaultValue="ana.ribeiro@email.com" /></label><label>Data de nascimento<input type="date" defaultValue="1994-05-18" /></label><label className="wide">Endereço<input defaultValue="Rua das Acácias, 85 — Centro" /></label></div><button className="primary">Salvar alterações</button></section>
        </>}
      </section>
      {cartOpen && <MiniCart items={cart} onClose={() => setCartOpen(false)} onQuantity={changeQuantity} onCheckout={() => { setCartOpen(false); setPaid(false); setSection("pagamento") }} onCatalog={() => { setCartOpen(false); setSection("catalogo") }} />}
      {requestOrder && (
        <div className="modal-backdrop">
          <form className="modal reschedule-modal" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); onOrderRequest(requestOrder, `Reagendamento solicitado para ${String(data.get("date"))} às ${String(data.get("time"))}`); setRequestOrder(null) }}>
            <div className="modal-title"><div><p>REAGENDAMENTO</p><h2>Escolha uma nova data</h2></div><button type="button" onClick={() => setRequestOrder(null)}>×</button></div>
            <div className="form-grid"><label>Nova data<input required name="date" type="date" /></label><label>Novo horário<input required name="time" type="time" /></label><label className="wide">Motivo<textarea name="reason" placeholder="Conte o motivo da alteração..." /></label></div>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => setRequestOrder(null)}>Voltar</button><button className="primary">Enviar solicitação</button></div>
          </form>
        </div>
      )}
      {cartToast && <div className="toast">✓ {cartToast}</div>}
    </main>
  );
}

function OrderTimeline({ status, paid }: { status: string; paid: boolean }) {
  const steps = ["Confirmado", "Pagamento", "Em produção", "Pronto"];
  const activeIndex = status === "Pronto" ? 3 : status === "Em produção" ? 2 : status === "Confirmado" ? 0 : 0;
  return (
    <div className="timeline">
      {steps.map((step, i) => {
        const done = i < activeIndex || (i === 1 && paid);
        const active = i === activeIndex && step !== "Pagamento";
        return (
          <div key={step} className={done ? "done" : active ? "active" : ""}>
            <i>{done ? "✓" : i + 1}</i>
            <span>{step}<small>{done ? "Concluído" : active ? "Agora" : "Em breve"}</small></span>
          </div>
        );
      })}
    </div>
  );
}

function MiniCart({ items, onClose, onQuantity, onCheckout, onCatalog }: { items: CartItem[]; onClose: () => void; onQuantity: (id: Product["id"],delta: number) => void; onCheckout: () => void; onCatalog: () => void }) {
  const total = items.reduce((sum, item) => sum + priceNumber(item.product.price) * item.quantity, 0);
  return (
    <div className="minicart-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="minicart" role="dialog" aria-modal="true" aria-label="Seu carrinho">
        <header><div><p className="eyebrow">SUA SELEÇÃO</p><h2>Carrinho</h2></div><button onClick={onClose} aria-label="Fechar carrinho">×</button></header>
        {items.length === 0 ? (
          <div className="empty-cart"><span>🧁</span><h3>Seu carrinho está vazio</h3><p>Escolha suas delícias no catálogo para montar o pedido.</p><button onClick={onCatalog}>Ver catálogo</button></div>
        ) : (
          <>
            <div className="minicart-items">
              {items.map(item => (
                <article key={item.product.id}>
                  <ProductVisual product={item.product} />
                  <div className="cart-item-copy">
                    <small>{item.product.category}</small>
                    <h3>{item.product.name}</h3>
                    <b>{money(priceNumber(item.product.price) * item.quantity)}</b>
                    <div className="quantity-control"><button onClick={() => onQuantity(item.product.id, -1)} aria-label={`Diminuir ${item.product.name}`}>−</button><span>{item.quantity}</span><button onClick={() => onQuantity(item.product.id, 1)} aria-label={`Aumentar ${item.product.name}`}>＋</button></div>
                  </div>
                  <button className="remove-item" onClick={() => onQuantity(item.product.id, -item.quantity)} aria-label={`Remover ${item.product.name}`}>×</button>
                </article>
              ))}
            </div>
            <footer>
              <div><span>Subtotal</span><b>{money(total)}</b></div>
              <small>Frete e data de entrega serão combinados com a confeitaria.</small>
              <button className="checkout-cart" onClick={onCheckout}>Finalizar pedido <span>→</span></button>
              <button className="continue-shopping" onClick={onCatalog}>Continuar comprando</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function Payment({ paid, cart, onPay }: { paid: boolean; cart: CartItem[]; onPay: () => void }) {
  const [method, setMethod] = useState("pix");
  const checkoutItems = cart;
  if (!paid && checkoutItems.length === 0) {
    return (
      <div className="empty-cart">
        <span>🧁</span>

        <h3>Nenhum produto selecionado</h3>

        <p>
          Adicione produtos ao carrinho antes de realizar
          o pagamento.
        </p>
      </div>
    );
  }
  const total = checkoutItems.reduce((sum, item) => sum + priceNumber(item.product.price) * item.quantity, 0);
  if (paid) return <div className="success-state"><span>✓</span><h1>Pagamento confirmado!</h1><p>Seu pedido com {checkoutItems.reduce((sum, item) => sum + item.quantity, 0)} {checkoutItems.length === 1 ? "item" : "itens"} foi recebido. A confeitaria já pode iniciar a produção.</p><Status>Confirmado</Status></div>;
  return (
    <>
      <div className="client-page-title"><p className="eyebrow">PAGAMENTO</p><h1>Finalize sua encomenda</h1><span>Revise todos os itens e escolha a forma de pagamento.</span></div>
      <div className="payment-layout">
        <section className="panel payment-card">
          <h2>Forma de pagamento</h2>
          <div className="payment-methods">
            <button className={method === "pix" ? "active" : ""} onClick={() => setMethod("pix")}><span>◆</span><b>Pix</b><small>Aprovação imediata</small></button>
            <button className={method === "card" ? "active" : ""} onClick={() => setMethod("card")}><span>▰</span><b>Cartão</b><small>Até 3x sem juros</small></button>
          </div>
          {method === "pix" ? (
            <div className="pix-box"><div className="qr-demo">▦</div><div><b>Escaneie o QR Code</b><p>Ou copie o código Pix para pagar no aplicativo do seu banco.</p><button>Copiar código Pix</button></div></div>
          ) : (
            <div className="form-grid card-fields"><label className="wide">Número do cartão<input placeholder="0000 0000 0000 0000" /></label><label>Validade<input placeholder="MM/AA" /></label><label>CVV<input placeholder="123" /></label><label className="wide">Nome no cartão<input placeholder="Como está no cartão" /></label></div>
          )}
          <button className="confirm-payment" onClick={onPay}>Confirmar pagamento de {money(total)}</button>
          <small className="secure-note">⌑ Ambiente seguro • Pagamento demonstrativo</small>
        </section>
        <aside className="panel order-summary">
          <h2>Resumo do pedido</h2>
          {checkoutItems.map(item => <div key={item.product.id}><span>{item.quantity}× {item.product.name}</span><b>{money(priceNumber(item.product.price) * item.quantity)}</b></div>)}
          <div><span>Entrega</span><b>A combinar</b></div>
          <hr />
          <div className="total"><span>Total</span><b>{money(total)}</b></div>
          <small>Prazo confirmado após o pedido.</small>
        </aside>
      </div>
    </>
  );
}

function Review({ reviewed, stars, setStars, onSubmit }: { reviewed: boolean; stars: number; setStars: (n: number) => void; onSubmit: () => void }) {
  if (reviewed) return <div className="success-state review-success"><span>★</span><h1>Obrigado pela avaliação!</h1><p>Sua opinião ajuda a confeitaria a tornar cada experiência ainda mais especial.</p></div>;
  return (
    <>
      <div className="client-page-title"><p className="eyebrow">AVALIAÇÃO</p><h1>Como foi sua experiência?</h1><span>Avalie um pedido já concluído.</span></div>
      <form className="panel review-card" onSubmit={e => { e.preventDefault(); onSubmit() }}>
        <div className="review-product"><span>🥧</span><div><small>PEDIDO #1032</small><h2>Torta de Limão</h2><p>Entregue em 12 de junho de 2026</p></div></div>
        <label>Sua nota<div className="stars">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={n <= stars ? "selected" : ""} onClick={() => setStars(n)} aria-label={`${n} estrelas`}>★</button>)}</div></label>
        <label>Conte como foi<textarea required placeholder="Sabor, apresentação, atendimento..." /></label>
        <button className="primary" disabled={!stars}>Enviar avaliação</button>
      </form>
    </>
  );
}

function AdminQuotes({ quotes, onUpdate }: { quotes: Quote[]; onUpdate: (id: string, value: string, status: string) => void }) {
  const [editing, setEditing] = useState<Quote | null>(null);
  return (
    <div className="content">
      <div className="page-actions"><div><h2 className="section-title">Solicitações de orçamento</h2><p className="section-subtitle">Analise, defina o valor e envie a proposta ao cliente.</p></div></div>
      <div className="quote-grid">
        {quotes.map(q => (
          <article className="panel quote-card" key={q.id}>
            <div><span>{q.id}</span><Status>{q.status}</Status></div>
            <small>{q.client} • Entrega {q.date}</small>
            <h3>{q.item}</h3>
            <p>{q.details}</p>
            <footer><strong>{q.value}</strong><button onClick={() => setEditing(q)}>{q.status === "Em análise" ? "Montar proposta" : "Editar proposta"}</button></footer>
          </article>
        ))}
      </div>
      {editing && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); onUpdate(editing.id, `R$ ${String(d.get("value")).replace("R$", "").trim()}`, "Aguardando cliente"); setEditing(null) }}>
            <div className="modal-title"><div><p>{editing.id}</p><h2>Enviar proposta</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></div>
            <div className="form-grid"><label>Valor proposto<input name="value" required defaultValue={editing.value.replace("R$ ", "")} /></label><label>Validade<input type="date" required /></label><label className="wide">Mensagem ao cliente<textarea defaultValue="Inclui produção, acabamento e embalagem. Frete a combinar." /></label></div>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Enviar orçamento</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function ClientQuotes({ quotes, onAnswer }: { quotes: Quote[]; onAnswer: (id: string, status: string) => void }) {
  return (
    <>
      <div className="client-page-title"><p className="eyebrow">PROPOSTAS</p><h1>Meus orçamentos</h1><span>Aceite ou recuse as propostas enviadas pela confeitaria.</span></div>
      <div className="quote-grid client-quotes">
        {quotes.map(q => (
          <article className="panel quote-card" key={q.id}>
            <div><span>{q.id}</span><Status>{q.status}</Status></div>
            <small>Entrega prevista: {q.date}</small>
            <h3>{q.item}</h3>
            <p>{q.details}</p>
            <footer><strong>{q.value}</strong>{q.status === "Aguardando cliente" ? <div><button className="secondary" onClick={() => onAnswer(q.id, "Recusado")}>Recusar</button><button onClick={() => onAnswer(q.id, "Aceito")}>Aceitar proposta</button></div> : <Status>{q.status}</Status>}</footer>
          </article>
        ))}
      </div>
    </>
  );
}

function Inventory({ products, onStock }: { products: Product[]; onStock: ( id: Product["id"], stock: number ) => void }) {
  const low = products.filter(p => p.stock <= p.lowStock);
  return (
    <div className="content">
      <div className="kpis inventory-kpis">
        <Kpi icon="▦" label="Itens cadastrados" value={String(products.length)} note="Produtos ativos" tone="green" />
        <Kpi icon="!" label="Estoque baixo" value={String(low.length)} note="Requer atenção" tone="gold" />
        <Kpi icon="✓" label="Disponíveis" value={String(products.filter(p => p.stock > 0).length)} note="Prontos para venda" tone="green" />
      </div>
      <section className="panel inventory-panel">
        <PanelHead icon="▦" title="Controle de estoque" subtitle="Atualize as quantidades disponíveis" />
        <div className="inventory-list">
          {products.map(p => (
            <article key={p.id}>
              <ProductVisual product={p} />
              <div><small>{p.category}</small><b>{p.name}</b><span className={p.stock <= p.lowStock ? "stock-low" : "stock-ok"}>{p.stock === 0 ? "Sem estoque" : p.stock <= p.lowStock ? "Estoque baixo" : "Estoque normal"}</span></div>
              <div className="stock-control"><button onClick={() => onStock(p.id, Math.max(0, p.stock - 1))}>−</button><input aria-label={`Estoque de ${p.name}`} type="number" value={p.stock} onChange={e => onStock(p.id, Math.max(0, Number(e.target.value)))} /><button onClick={() => onStock(p.id, p.stock + 1)}>＋</button></div>
              <small>Alerta em {p.lowStock}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function NotificationPanel({ items, onClose, onRead }: { items: string[]; onClose: () => void; onRead: () => void }) {
  return (
    <aside className="notification-panel">
      <header><div><p className="eyebrow">ATUALIZAÇÕES</p><h2>Notificações</h2></div><button onClick={onClose}>×</button></header>
      {items.length ? (
        <>
          <div>{items.map((item, i) => <article key={`${item}-${i}`}><span>{i === 1 ? "!" : "✓"}</span><div><b>{item}</b><small>Agora mesmo</small></div></article>)}</div>
          <button className="read-all" onClick={onRead}>Marcar todas como lidas</button>
        </>
      ) : (
        <div className="empty-notifications"><span>✓</span><p>Tudo em dia por aqui.</p></div>
      )}
    </aside>
  );
}

function Dashboard({ setScreen, openModal, orders }: { setScreen: (s: Screen) => void; openModal: () => void; orders: any[] }) {
  return (
    <div className="content">
      <div className="kpis">
        <Kpi icon="▢" label="Pedidos hoje" value="18" note="+4 desde ontem" tone="green" />
        <Kpi icon="▥" label="Faturamento" value="R$ 3.840" note="+12,5% esta semana" tone="green" />
        <Kpi icon="♨" label="Em produção" value="7" note="3 com prioridade" tone="gold" />
        <Kpi icon="▭" label="Aguardando entrega" value="5" note="Próxima às 10:30" tone="gold" />
      </div>
      <div className="dashboard-grid">
        <section className="panel orders-panel">
          <PanelHead icon="▣" title="Próximos pedidos" action="Ver todos" onClick={() => setScreen("Pedidos")} />
          <OrderTable orders={orders} />
          <button className="quick-add" onClick={openModal}>＋ Adicionar novo pedido</button>
        </section>
        <div className="stack">
          <section className="panel production-card">
            <PanelHead icon="♨" title="Produção de hoje" subtitle="68% concluída" />
            <div className="big-progress"><i style={{ width: "68%" }} /></div>
            {[["Bolos", 80], ["Doces", 65], ["Salgados", 60]].map(([name, n]) => (
              <div className="progress-row" key={name}><span>{name}</span><div><i style={{ width: `${n}%` }} /></div><b>{n}%</b></div>
            ))}
          </section>
          <section className="panel agenda">
            <PanelHead icon="□" title="Agenda de hoje" action="Ver agenda" />
            <div className="agenda-item"><b>10:30</b><i className="gold-dot" /><span><strong>Entrega: Ana Ribeiro</strong><small>Bolo Red Velvet</small></span></div>
            <div className="agenda-item"><b>12:00</b><i className="pink-dot" /><span><strong>Retirada: Carlos Mendes</strong><small>Kit Festa 30 pessoas</small></span></div>
            <div className="sales-strip"><span>⌁ &nbsp; Vendas do dia</span><strong>R$ 2.150</strong><em>+8,7%</em></div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, note, tone }: { icon: string; label: string; value: string; note: string; tone: string }) {
  return (
    <article className="kpi">
      <span className="kpi-icon">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong><em className={tone}>{note}</em></div>
    </article>
  );
}

function PanelHead({ icon, title, subtitle, action, onClick }: { icon: string; title: string; subtitle?: string; action?: string; onClick?: () => void }) {
  return (
    <div className="panel-head">
      <span>{icon}</span>
      <div><h2>{title}</h2>{subtitle && <strong>{subtitle}</strong>}</div>
      {action && <button onClick={onClick}>{action} ›</button>}
    </div>
  );
}

function OrderTable({ orders }: { orders: any[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Pedido</th><th>Horário</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td><span className="initials">{o.initials}</span><strong>{o.client}</strong></td>
              <td>{o.item}</td>
              <td>{o.time}</td>
              <td><Status>{o.status}</Status></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Orders({ orders, openModal, onStatus }: { orders: any[]; openModal: () => void; onStatus: (id: string, status: string) => void }) {
  return (
    <div className="content">
      <div className="page-actions">
        <div className="tabs"><button className="selected">Todos</button><button>Hoje</button><button>Solicitações</button></div>
        <button className="new-order" onClick={openModal}>＋ Novo pedido</button>
      </div>
      <section className="panel full-table">
        <PanelHead icon="▣" title="Acompanhar pedidos" subtitle={`${orders.length} pedidos encontrados`} />
        <div className="admin-orders-list">
          {orders.map(o => (
            <article key={o.id}>
              <div className="order-id"><span className="initials">{o.initials}</span><div><small>{o.id}</small><b>{o.client}</b></div></div>
              <div><small>Pedido</small><b>{o.item}</b>{o.request && <span className="request-badge">{o.request}</span>}</div>
              <div><small>Entrega</small><b>{o.date}, {o.time}</b></div>
              <div><small>Valor</small><b>{o.value}</b></div>
              <label><small>Atualizar status</small><select value={o.status} onChange={e => onStatus(o.id, e.target.value)}><option>Aguardando</option><option>Confirmado</option><option>Em produção</option><option>Pronto</option><option>Entregue</option><option>Cancelado</option></select>{o.request && <button className="approve-request" onClick={() => onStatus(o.id, o.request.includes("Cancelamento") ? "Cancelado" : "Confirmado")}>Aprovar solicitação</button>}</label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Production() {
  const stages = [["Aguardando", 3], ["Em preparo", 4], ["Finalização", 2], ["Pronto", 5]];
  return (
    <div className="content">
      <div className="kanban">
        {stages.map(([stage, count], i) => (
          <section className="kanban-col" key={stage}>
            <header><h3>{stage}</h3><b>{count}</b></header>
            {orders.slice(i, i + 3).map(o => (
              <article className="task" key={o.id}>
                <small>{o.id} • {o.time}</small>
                <h4>{o.item}</h4>
                <p>{o.client}</p>
                <div><Status>{i === 3 ? "Pronto" : i === 0 ? "Aguardando" : "Em produção"}</Status><span className="initials">{o.initials}</span></div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function Catalog({ products, onChange, onToast }: { products: Product[]; onChange: (p: Product[]) => void; onToast: (m: string) => void }) {
  const [editing, setEditing] =
    useState<Product | null>(null);

  const [open, setOpen] = useState(false);
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  function startEdit(product?: Product) {
    setEditing(product || null);
    setImage(product?.image || "");
    setImageFile(null);
    setOpen(true);
  }

  function handleImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setImageFile(file);

    const reader = new FileReader();

    reader.onload = () => {
      setImage(String(reader.result));
    };

    reader.readAsDataURL(file);
  }
  function update( id: Product["id"], patch: Partial<Product>) { onChange(products.map(p => p.id === id ? { ...p, ...patch } : p)) }
  async function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (editing) {
      onToast(
        "A edição será conectada na próxima etapa."
      );
      return;
    }

    if (!imageFile) {
      onToast("Selecione uma foto para o produto.");
      return;
    }

    const form = e.currentTarget;
    const data = new FormData(form);

    const price = databasePrice(
      String(data.get("price") || "")
    );

    if (!Number.isFinite(price) || price <= 0) {
      onToast("Informe um preço válido.");
      return;
    }

    setSaving(true);

    let uploadedImagePath = "";

    try {
      const fileExtension =
        imageFile.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      uploadedImagePath =
        `products/${crypto.randomUUID()}.${fileExtension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("product-images")
        .upload(uploadedImagePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error(
          "Erro ao enviar imagem:",
          uploadError
        );

        onToast(
          "Não foi possível enviar a imagem."
        );

        return;
      }

      const {
        data: publicImageData,
      } = supabase.storage
        .from("product-images")
        .getPublicUrl(uploadedImagePath);

      const options = String(
        data.get("options") || ""
      )
        .split(",")
        .map(option => option.trim())
        .filter(Boolean);

      const isFeatured =
        data.get("featured") === "on";

      const {
        data: createdProduct,
        error: productError,
      } = await supabase
        .from("products")
        .insert({
          name: String(data.get("name") || "").trim(),
          category: String(
            data.get("category") || ""
          ),
          price,
          description: String(
            data.get("description") || ""
          ).trim(),
          image_url: publicImageData.publicUrl,
          preparation_time: String(
            data.get("preparation") || ""
          ).trim(),
          minimum_order: String(
            data.get("minimum") || ""
          ).trim(),
          stock_quantity:
            Number(data.get("stock")) || 0,
          low_stock_limit:
            Number(data.get("lowStock")) || 0,
          is_active: data.get("active") === "on",
          is_archived: false,
          is_featured: isFeatured,
          featured_order: isFeatured
            ? products.length + 1
            : null,
          is_customizable:
            data.get("customizable") === "on",
        })
        .select(`
          id,
          name,
          category,
          price,
          description,
          image_url,
          preparation_time,
          minimum_order,
          stock_quantity,
          low_stock_limit,
          is_active,
          is_archived,
          is_featured,
          featured_order,
          is_customizable
        `)
        .single();

      if (productError || !createdProduct) {
        console.error(
          "Erro ao cadastrar produto:",
          productError
        );

        await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);

        onToast(
          "Não foi possível cadastrar o produto."
        );

        return;
      }

      if (options.length > 0) {
      const {
        error: optionsError,
      } = await supabase
        .from("product_options")
        .insert(
          options.map(optionName => ({
            product_id: createdProduct.id,
            option_name: optionName,
            option_value: "A combinar",
            additional_price: 0,
            is_active: true,
          }))
        );

      if (optionsError) {
        console.error(
          "Erro ao cadastrar personalizações:",
          optionsError
        );

        await supabase
          .from("products")
          .delete()
          .eq("id", createdProduct.id);

        await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);

        onToast(
          "Não foi possível cadastrar as personalizações."
        );

        return;
      }
    }

      const product = {
        ...mapProduct(
          createdProduct as ProductRow
        ),
        options,
      };

      onChange([product, ...products]);

      setOpen(false);
      setImage("");
      setImageFile(null);

      onToast("Produto publicado com sucesso!");
    } catch (error) {
      console.error(
        "Erro inesperado ao cadastrar produto:",
        error
      );

      if (uploadedImagePath) {
        await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);
      }

      onToast(
        "Ocorreu um erro ao cadastrar o produto."
      );
    } finally {
      setSaving(false);
    }
  }
  const visible = products.filter(p => !p.archived);
  return (
    <div className="content">
      <div className="page-actions">
        <div><h2 className="section-title">Produtos do catálogo</h2><p className="section-subtitle">{visible.filter(p => p.active).length} publicados • {products.filter(p => p.archived).length} arquivados</p></div>
        <button className="new-order" onClick={() => startEdit()}>＋ Adicionar produto</button>
      </div>
      <div className="product-grid">
        {visible.map(p => (
          <article className={`product admin-product ${!p.active ? "disabled" : ""}`} key={p.id}>
            <ProductVisual product={p} />
            <div className="product-body">
              <div className="product-topline"><small>{p.category}</small>{p.featured && <span>Destaque #{p.featuredOrder}</span>}</div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="product-meta"><span>◷ {p.preparation}</span><span>{p.stock} em estoque</span>{p.customizable && <span>Personalizável</span>}</div>
              <div className="product-bottom"><strong>{p.price}</strong><button className={p.active ? "published" : "draft"} onClick={() => update(p.id, { active: !p.active })}>{p.active ? "Publicado" : "Oculto"}</button></div>
              <div className="product-admin-actions">
                <button onClick={() => startEdit(p)}>Editar</button>
                <button onClick={() => { onChange([{ ...p, id: Date.now(), name: `${p.name} — cópia`, active: false, featured: false }, ...products]); onToast("Produto duplicado!") }}>Duplicar</button>
                <button onClick={() => update(p.id, { archived: true, active: false })}>Arquivar</button>
                <button className="danger" onClick={() => confirm(`Excluir ${p.name}?`) && onChange(products.filter(x => x.id !== p.id))}>Excluir</button>
              </div>
              {p.featured && <div className="feature-order"><span>Ordem do destaque</span><button onClick={() => update(p.id, { featuredOrder: Math.max(1, p.featuredOrder - 1) })}>↑</button><button onClick={() => update(p.id, { featuredOrder: p.featuredOrder + 1 })}>↓</button></div>}
            </div>
          </article>
        ))}
      </div>
      {products.some(p => p.archived) && (
        <section className="archived-products panel">
          <h3>Produtos arquivados</h3>
          {products.filter(p => p.archived).map(p => <div key={p.id}><span>{p.name}</span><button onClick={() => update(p.id, { archived: false })}>Restaurar</button></div>)}
        </section>
      )}
      {open && (
        <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && setOpen(false)}>
          <form className="modal product-modal" onSubmit={submit}>
            <div className="modal-title"><div><p>{editing ? "EDITAR PRODUTO" : "NOVO PRODUTO"}</p><h2>{editing ? "Atualizar catálogo" : "Adicionar ao catálogo"}</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></div>
            <div className="product-form-layout">
              <label className="image-upload">
                {image ? <img src={image} alt="Prévia" /> : <><span>▧</span><b>Adicionar foto</b><small>PNG ou JPG</small></>}
                <input required={!editing} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage}/>
              </label>
              <div className="form-grid compact-form">
                <label className="wide">Título<input required name="name" defaultValue={editing?.name} /></label>
                <label>Categoria<select name="category" defaultValue={editing?.category}><option>Bolos</option><option>Tortas</option><option>Doces</option><option>Salgados</option><option>Kits</option><option>Outros</option></select></label>
                <label>Preço base<input required name="price" defaultValue={editing?.price.replace("R$ ", "")} /></label>
                <label>Prazo<input required name="preparation" defaultValue={editing?.preparation} /></label>
                <label>Pedido mínimo<input required name="minimum" defaultValue={editing?.minimum} /></label>
                <label>Estoque atual<input required name="stock" type="number" defaultValue={editing?.stock || 0} /></label>
                <label>Alerta de estoque<input required name="lowStock" type="number" defaultValue={editing?.lowStock || 3} /></label>
              </div>
            </div>
            <div className="form-grid product-description">
              <label className="wide">Descrição<textarea required name="description" defaultValue={editing?.description} /></label>
              <label className="wide">Opções de personalização<input name="options" defaultValue={editing?.options.join(", ")} placeholder="Tamanho, recheio, decoração" /></label>
            </div>
            <div className="product-checks">
              <label><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Publicar</label>
              <label><input name="featured" type="checkbox" defaultChecked={editing?.featured} /> Destaque</label>
              <label><input name="customizable" type="checkbox" defaultChecked={editing?.customizable ?? true} /> Permitir personalização</label>
            </div>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="primary" disabled={saving} > {saving  ? "Salvando produto..." : "Salvar produto"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function ProductVisual({ product }: { product: Product }) {
  const fallback: Record<string, string> = { Bolos: "🍰", Tortas: "🥧", Doces: "🍫", Salgados: "🥐", Kits: "🎂", Outros: "🧁" };
  return <div className="product-img">{product.image ? <img src={product.image} alt={product.name} /> : fallback[product.category] || "🧁"}</div>;
}

function ClientCatalog({ products, onChoose, onAdd }: { products: Product[]; onChoose: (p: Product) => void; onAdd: (p: Product) => void }) {
  const [category, setCategory] = useState("Todos");
  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category)))];
  const list = category === "Todos" ? products : products.filter(p => p.category === category);
  const visible = [...list].sort((a, b) => (Number(b.featured) - Number(a.featured)) || (a.featuredOrder - b.featuredOrder));
  return (
    <>
      <div className="catalog-hero"><p className="eyebrow">NOSSO CARDÁPIO</p><h1>Feitos à mão,<br />pensados para você.</h1><span>Adicione quantos produtos quiser e finalize tudo no carrinho.</span></div>
      <div className="catalog-filters">{categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <div className="client-catalog-grid">
        {visible.map(p => (
          <article className={`catalog-card ${p.stock === 0 ? "sold-out" : ""}`} key={p.id}>
            <ProductVisual product={p} />
            <div>
              <small>{p.category}{p.featured ? " • DESTAQUE" : ""}</small>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="catalog-meta"><span>◷ {p.preparation}</span><span>{p.stock === 0 ? "Indisponível" : `Disponível: ${p.stock}`}</span></div>
              <footer>
                <div><small>A partir de</small><strong>{p.price}</strong></div>
                <div className="catalog-actions">
                  {p.customizable && <button className="customize-product" onClick={() => onChoose(p)}>Personalizar</button>}
                  <button disabled={p.stock === 0} onClick={() => onAdd(p)}>{p.stock === 0 ? "Esgotado" : "＋ Carrinho"}</button>
                </div>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Clients() {
  return (
    <div className="content">
      <section className="panel full-table">
        <PanelHead icon="♙" title="Clientes" subtitle="Sua base de clientes" action="+ Novo cliente" />
        <div className="client-grid">
          {clients.map(c => (
            <article className="client" key={c.name}>
              <span className="initials large">{c.initials}</span>
              <div><h3>{c.name}</h3><p>{c.email}</p></div>
              <dl><div><dt>Pedidos</dt><dd>{c.orders}</dd></div><div><dt>Total gasto</dt><dd>{c.spent}</dd></div></dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Finance() {
  return (
    <div className="content">
      <div className="kpis finance-kpis">
        <Kpi icon="$" label="Receita no mês" value="R$ 28.540" note="+18,2% vs. mês anterior" tone="green" />
        <Kpi icon="↘" label="Despesas" value="R$ 9.860" note="34,5% da receita" tone="gold" />
        <Kpi icon="◇" label="Lucro estimado" value="R$ 18.680" note="Margem de 65,5%" tone="green" />
      </div>
      <section className="panel chart-panel">
        <PanelHead icon="▥" title="Fluxo financeiro" subtitle="Últimos 7 meses" />
        <div className="chart">
          {[42, 58, 48, 72, 65, 82, 94].map((h, i) => (
            <div key={i}><i style={{ height: `${h}%` }} /><small>{["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"][i]}</small></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Reports() {
  return (
    <div className="content">
      <div className="report-grid">
        {[["Vendas por período", "Acompanhe faturamento, ticket médio e evolução."], ["Produtos mais vendidos", "Descubra os itens favoritos dos seus clientes."], ["Desempenho da produção", "Avalie prazos, volume e eficiência da equipe."], ["Clientes recorrentes", "Identifique fidelidade e oportunidades de contato."]].map(([t, p], i) => (
          <article className="panel report" key={t}>
            <span>{["▥", "♨", "◴", "♙"][i]}</span>
            <h3>{t}</h3>
            <p>{p}</p>
            <button>Gerar relatório ›</button>
          </article>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="content">
      <section className="panel settings">
        <h2>Dados da confeitaria</h2>
        <p>Informações usadas nos pedidos e relatórios.</p>
        <div className="form-grid">
          <label>Nome da confeitaria<input defaultValue="Doce Encanto Confeitaria" /></label>
          <label>CNPJ<input defaultValue="12.345.678/0001-90" /></label>
          <label>E-mail<input defaultValue="contato@doceencanto.com.br" /></label>
          <label>Telefone<input defaultValue="(22) 99999-1234" /></label>
          <label className="wide">Endereço<input defaultValue="Rua das Flores, 120 — Centro" /></label>
        </div>
        <button className="primary">Salvar alterações</button>
      </section>
    </div>
  );
}