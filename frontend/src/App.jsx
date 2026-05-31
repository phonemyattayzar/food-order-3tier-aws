import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Header from "./components/Header";
import AuthView from "./components/AuthView";
import RestaurantDetailView from "./components/RestaurantDetailView";
import RestaurantListView from "./components/RestaurantListView";
import AddRestaurantModal from "./components/AddRestaurantModal";
import AddCategoryModal from "./components/AddCategoryModal";
import AddMenuItemModal from "./components/AddMenuItemModal";
import CheckoutModal from "./components/CheckoutModal";
import MyOrdersView from "./components/MyOrdersView";
import OrderHistoryView from "./components/OrderHistoryView";
import OwnerAnalyticsView from "./components/OwnerAnalyticsView";
import AdminDashboardView from "./components/AdminDashboardView";
import {
  apiRequest,
  fetchCurrentUser,
  login,
  parseApiError,
  setToken,
} from "./api/client";

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("sar_mel_theme") || "bright";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sar_mel_theme", theme);
  }, [theme]);

  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [regForm, setRegForm] = useState({
    email: "",
    full_name: "",
    role: "customer",
    password: "",
  });

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [townshipVal, setTownshipVal] = useState("");

  const [groupedMenu, setGroupedMenu] = useState([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");

  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);

  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    phone_number: "09",
    address: "",
    township: "",
    is_open: true,
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const [menuItemForm, setMenuItemForm] = useState({
    name: "",
    description: "",
    price_mmk: "",
    is_available: true,
    preparation_time_minutes: "",
    category_id: "",
    image_url: "",
  });

  const [notification, setNotification] = useState(null);

  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showOrderManagement, setShowOrderManagement] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [orders, setOrders] = useState([]);
  const [managedOrders, setManagedOrders] = useState([]);
  const [orderHistoryFilter, setOrderHistoryFilter] = useState("pending");
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderActionId, setOrderActionId] = useState(null);
  const [ordersLastUpdated, setOrdersLastUpdated] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [lastPendingCount, setLastPendingCount] = useState(0);

  const POLL_MS = 8000;

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const clearSession = () => {
    setActiveUser(null);
    setSelectedRestaurant(null);
    setToken(null);
    localStorage.removeItem("active_user");
  };

  const establishSession = async (user) => {
    setActiveUser(user);
    localStorage.setItem("active_user", JSON.stringify(user));
    fetchRestaurants(searchVal, townshipVal);
  };

  const restoreSession = async () => {
    setAuthLoading(true);
    try {
      const user = await fetchCurrentUser();
      await establishSession(user);
    } catch {
      clearSession();
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRestaurants();
    restoreSession();
  }, []);

  const fetchUsers = async () => {
    try {
      const { res, data } = await apiRequest("/users/", { auth: false });
      if (res.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchRestaurants = async (search = "", township = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (township) params.append("township", township);
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const path = queryStr ? `/restaurants/${queryStr}` : "/restaurants/";

      const { res, data } = await apiRequest(path, { auth: true });
      if (res.ok) {
        setRestaurants(data);
      } else {
        showToast(parseApiError(data, "Could not load restaurants"), "error");
      }
    } catch {
      showToast("Could not load restaurants", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantMenu = async (restaurantId) => {
    try {
      const { res, data } = await apiRequest(
        `/menu-items/restaurant/${restaurantId}/menu`,
        { auth: false }
      );
      if (res.ok) {
        setGroupedMenu(data);
      } else {
        setGroupedMenu([]);
      }
    } catch (err) {
      console.error("Error fetching menu:", err);
      setGroupedMenu([]);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.email || !regForm.full_name || !regForm.password) {
      showToast("Please fill all required fields", "error");
      return;
    }

    try {
      const { res, data } = await apiRequest("/users/", {
        method: "POST",
        auth: false,
        body: JSON.stringify(regForm),
      });

      if (res.ok) {
        const { email, password } = regForm;
        showToast("Profile registered successfully!");
        setRegForm({ email: "", full_name: "", role: "customer", password: "" });
        fetchUsers();
        await handleLogin(email, password);
      } else {
        showToast(parseApiError(data, "Registration failed"), "error");
      }
    } catch {
      showToast("Registration failed", "error");
    }
  };

  const handleLogin = async (email, password) => {
    try {
      await login(email, password);
      const user = await fetchCurrentUser();
      await establishSession(user);
      showToast(`Logged in as ${user.full_name}`);
    } catch (err) {
      clearSession();
      showToast(err.message || "Login failed", "error");
      throw err;
    }
  };

  const handleLogout = () => {
    clearSession();
    setCart([]);
    setShowMyOrders(false);
    setShowOrderManagement(false);
    setShowAdminDashboard(false);
    setShowOwnerDashboard(false);
    setPendingOrderCount(0);
    setNotifications([]);
    setUnreadNotificationCount(0);
    showToast("Logged out successfully");
  };

  const fetchNotifications = async () => {
    if (!activeUser) return;
    try {
      const [listRes, countRes] = await Promise.all([
        apiRequest("/notifications/?unread_only=false"),
        apiRequest("/notifications/unread-count"),
      ]);
      if (listRes.res.ok) setNotifications(listRes.data);
      if (countRes.res.ok) setUnreadNotificationCount(countRes.data.count);
    } catch {
      // optional
    }
  };

  const fetchPendingCount = async () => {
    if (!activeUser || (activeUser.role !== "owner" && activeUser.role !== "admin")) {
      return;
    }
    try {
      const { res, data } = await apiRequest("/orders/pending");
      if (res.ok) {
        const count = data.length;
        if (
          count > lastPendingCount &&
          lastPendingCount > 0 &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("New order received", {
            body: `You have ${count} order(s) awaiting approval.`,
          });
        }
        setPendingOrderCount(count);
        setLastPendingCount(count);
      }
    } catch {
      // optional
    }
  };

  const fetchOrderHistory = async (filter = orderHistoryFilter) => {
    if (!activeUser || (activeUser.role !== "owner" && activeUser.role !== "admin")) return;
    setOrdersLoading(true);
    try {
      const statusParam = filter === "all" ? "" : `?status=${filter}`;
      const { res, data } = await apiRequest(`/orders/manage${statusParam}`);
      if (res.ok) {
        setManagedOrders(data);
        setOrdersLastUpdated(new Date());
      }
    } catch {
      showToast("Could not load orders", "error");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!activeUser) return;

    if (activeUser.role === "owner" || activeUser.role === "admin") {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
      fetchPendingCount();
      fetchNotifications();
    }

    if (activeUser.role === "customer") {
      fetchNotifications();
    }
  }, [activeUser?.id, activeUser?.role]);

  useEffect(() => {
    if (!activeUser) return;

    const poll = () => {
      fetchNotifications();

      if (activeUser.role === "customer" && showMyOrders) {
        fetchMyOrders(true);
      }

      if (
        (activeUser.role === "owner" || activeUser.role === "admin") &&
        (showOrderManagement || !showMyOrders)
      ) {
        fetchPendingCount();
        if (showOrderManagement) {
          fetchOrderHistory(orderHistoryFilter);
        }
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [
    activeUser?.id,
    activeUser?.role,
    showMyOrders,
    showOrderManagement,
    orderHistoryFilter,
  ]);

  const fetchMyOrders = async (silent = false) => {
    if (!activeUser) return;
    if (!silent) setOrdersLoading(true);
    try {
      const { res, data } = await apiRequest(`/orders/user/${activeUser.id}`);
      if (res.ok) {
        setOrders(data);
        setOrdersLastUpdated(new Date());
      } else if (!silent) {
        showToast(parseApiError(data, "Could not load orders"), "error");
      }
    } catch {
      if (!silent) showToast("Could not load orders", "error");
    } finally {
      if (!silent) setOrdersLoading(false);
    }
  };

  const handleOpenMyOrders = () => {
    setSelectedRestaurant(null);
    setShowOrderManagement(false);
    setShowAdminDashboard(false);
    setShowOwnerDashboard(false);
    setShowMyOrders(true);
    fetchMyOrders();
  };

  const handleBackFromOrders = () => {
    setShowMyOrders(false);
  };

  const handleOpenOrderManagement = () => {
    setSelectedRestaurant(null);
    setShowMyOrders(false);
    setShowAdminDashboard(false);
    setShowOwnerDashboard(false);
    setShowOrderManagement(true);
    fetchOrderHistory(orderHistoryFilter);
  };

  const handleBackFromOrderManagement = () => {
    setShowOrderManagement(false);
  };

  const handleOrderHistoryFilterChange = (filter) => {
    setOrderHistoryFilter(filter);
    fetchOrderHistory(filter);
  };

  const handleApproveOrder = async (orderId) => {
    setOrderActionId(orderId);
    try {
      const { res, data } = await apiRequest(`/orders/${orderId}/approve`, {
        method: "PATCH",
      });
      if (res.ok) {
        showToast(`Order ${data.order_number} confirmed`);
        fetchOrderHistory();
        fetchPendingCount();
        fetchNotifications();
      } else {
        showToast(parseApiError(data, "Could not approve order"), "error");
      }
    } catch {
      showToast("Could not approve order", "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const handleRejectOrder = async (orderId, rejection_reason = null) => {
    setOrderActionId(orderId);
    try {
      const { res, data } = await apiRequest(`/orders/${orderId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", rejection_reason })
      });
      if (res.ok) {
        showToast(`Order ${data.order_number} rejected`);
        fetchOrderHistory();
        fetchPendingCount();
        fetchNotifications();
      } else {
        showToast(parseApiError(data, "Could not reject order"), "error");
      }
    } catch {
      showToast("Could not reject order", "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const handleAdvanceOrderStatus = async (orderId, status) => {
    setOrderActionId(orderId);
    try {
      const { res, data } = await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Order ${data.order_number} updated`);
        fetchOrderHistory();
      } else {
        showToast(parseApiError(data, "Could not update order"), "error");
      }
    } catch {
      showToast("Could not update order", "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    setOrderActionId(orderId);
    try {
      const { res, data } = await apiRequest(`/orders/${orderId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        showToast(`Order ${data.order_number} cancelled`);
        fetchMyOrders();
      } else {
        showToast(parseApiError(data, "Could not cancel order"), "error");
      }
    } catch {
      showToast("Could not cancel order", "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    await apiRequest("/notifications/read-all", { method: "PATCH", json: false });
    fetchNotifications();
  };

  const handleMarkNotificationRead = async (id) => {
    await apiRequest(`/notifications/${id}/read`, { method: "PATCH", json: false });
    fetchNotifications();
  };

  const handleNotificationsOpenOrders = () => {
    if (activeUser?.role === "customer") {
      handleOpenMyOrders();
    } else if (activeUser?.role === "owner" || activeUser?.role === "admin") {
      setOrderHistoryFilter("pending");
      handleOpenOrderManagement();
    }
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price_mmk: item.price_mmk,
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQty = (menuItemId, newQty) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((c) => c.menu_item_id !== menuItemId));
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.menu_item_id === menuItemId ? { ...c, quantity: newQty } : c
      )
    );
  };

  const handlePlaceOrder = async (e, couponCode = null) => {
    e.preventDefault();
    if (!selectedRestaurant || cart.length === 0) return;

    if (!deliveryAddress.trim()) {
      showToast("Please enter a delivery address", "error");
      return;
    }

    setCheckoutSubmitting(true);
    try {
      const payload = {
        restaurant_id: selectedRestaurant.id,
        delivery_address: deliveryAddress.trim(),
        items: cart.map((c) => ({
          menu_item_id: c.menu_item_id,
          quantity: c.quantity,
        })),
        coupon_code: couponCode || null,
      };

      const { res, data } = await apiRequest("/orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        clearSession();
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        showToast(`Order submitted! ${data.order_number} — awaiting restaurant approval`);
        setCart([]);
        setShowCheckout(false);
        setDeliveryAddress("");
        setShowMyOrders(true);
        fetchMyOrders();
      } else {
        showToast(parseApiError(data, "Could not place order"), "error");
      }
    } catch {
      showToast("Could not place order", "error");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const canOrder =
    activeUser &&
    selectedRestaurant &&
    activeUser.id !== selectedRestaurant.owner_id;

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    if (!activeUser || (activeUser.role !== "owner" && activeUser.role !== "admin")) {
      showToast("Not authorized", "error");
      return;
    }

    try {
      const { res, data } = await apiRequest("/restaurants/", {
        method: "POST",
        body: JSON.stringify(restaurantForm),
      });

      if (res.status === 401) {
        clearSession();
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        showToast("Restaurant registration submitted! Awaiting admin approval.");
        setShowAddRestaurant(false);
        setRestaurantForm({
          name: "",
          description: "",
          phone_number: "09",
          address: "",
          township: "",
          is_open: true,
        });
        fetchRestaurants();
      } else {
        showToast(parseApiError(data, "Could not create restaurant"), "error");
      }
    } catch {
      showToast("Operation failed", "error");
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant) return;

    if (activeUser?.id !== selectedRestaurant.owner_id) {
      showToast("You can only manage your own restaurant's menu", "error");
      return;
    }

    try {
      const payload = {
        ...categoryForm,
        restaurant_id: selectedRestaurant.id,
      };

      const { res, data } = await apiRequest("/categories/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        clearSession();
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        showToast("Category added!");
        setShowAddCategory(false);
        setCategoryForm({ name: "", description: "" });
        fetchRestaurantMenu(selectedRestaurant.id);
      } else {
        showToast(parseApiError(data, "Could not add category"), "error");
      }
    } catch {
      showToast("Operation failed", "error");
    }
  };

  const handleCreateMenuItem = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant) return;

    if (activeUser?.id !== selectedRestaurant.owner_id) {
      showToast("You can only manage your own restaurant's menu", "error");
      return;
    }

    try {
      const payload = {
        name: menuItemForm.name,
        description: menuItemForm.description || null,
        price_mmk: parseInt(menuItemForm.price_mmk, 10),
        is_available: menuItemForm.is_available,
        preparation_time_minutes: menuItemForm.preparation_time_minutes
          ? parseInt(menuItemForm.preparation_time_minutes, 10)
          : null,
        restaurant_id: selectedRestaurant.id,
        category_id: menuItemForm.category_id || null,
        image_url: menuItemForm.image_url || null,
      };

      const method = menuItemForm.id ? "PUT" : "POST";
      const url = menuItemForm.id ? `/menu-items/${menuItemForm.id}` : "/menu-items/";

      const { res, data } = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        clearSession();
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        showToast(menuItemForm.id ? "Menu item updated!" : "Menu item added!");
        setShowAddMenuItem(false);
        setMenuItemForm({
          name: "",
          description: "",
          price_mmk: "",
          is_available: true,
          preparation_time_minutes: "",
          category_id: "",
          image_url: "",
        });
        fetchRestaurantMenu(selectedRestaurant.id);
      } else {
        showToast(parseApiError(data, "Could not save menu item"), "error");
      }
    } catch {
      showToast("Operation failed", "error");
    }
  };

  const handleViewRestaurant = (restaurant) => {
    setShowMyOrders(false);
    setShowOrderManagement(false);
    setShowAdminDashboard(false);
    setShowOwnerDashboard(false);
    setSelectedRestaurant(restaurant);
    setCart([]);
    setShowCheckout(false);
    fetchRestaurantMenu(restaurant.id);
    setActiveCategoryFilter("all");
  };

  if (authLoading) {
    return (
      <div className="layout-container">
        <div className="app-bg-glow" />
        <main className="app-main-content" style={{ textAlign: "center", padding: "80px 24px" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading Sar Mel...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <div className="app-bg-glow" />

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <Header
        theme={theme}
        setTheme={setTheme}
        activeUser={activeUser}
        handleLogout={handleLogout}
        setSelectedRestaurant={(r) => {
          setSelectedRestaurant(r);
          if (r === null) setCart([]);
          setShowMyOrders(false);
          setShowOrderManagement(false);
          setShowAdminDashboard(false);
          setShowOwnerDashboard(false);
        }}
        onMyOrders={activeUser?.role === "customer" ? handleOpenMyOrders : undefined}
        showMyOrders={showMyOrders}
        onOrderManagement={
          activeUser?.role === "owner" || activeUser?.role === "admin"
            ? handleOpenOrderManagement
            : undefined
        }
        showOrderManagement={showOrderManagement}
        onOpenAdminDashboard={() => {
          setSelectedRestaurant(null);
          setShowMyOrders(false);
          setShowOrderManagement(false);
          setShowOwnerDashboard(false);
          setShowAdminDashboard(true);
        }}
        showAdminDashboard={showAdminDashboard}
        onOpenOwnerDashboard={() => {
          setSelectedRestaurant(null);
          setShowMyOrders(false);
          setShowOrderManagement(false);
          setShowAdminDashboard(false);
          setShowOwnerDashboard(true);
        }}
        showOwnerDashboard={showOwnerDashboard}
        pendingOrderCount={pendingOrderCount}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onMarkNotificationRead={handleMarkNotificationRead}
        onNotificationsOpenOrders={handleNotificationsOpenOrders}
      />

      <main className="app-main-content">
        {!activeUser ? (
          <AuthView
            users={users}
            regForm={regForm}
            setRegForm={setRegForm}
            handleLogin={handleLogin}
            handleRegister={handleRegister}
          />
        ) : (
          <div>
            {showAdminDashboard ? (
              <AdminDashboardView
                onBack={() => {
                  setShowAdminDashboard(false);
                  fetchRestaurants(searchVal, townshipVal);
                }}
                onRestaurantStatusChanged={() =>
                  fetchRestaurants(searchVal, townshipVal)
                }
              />
            ) : showOwnerDashboard ? (
              <OwnerAnalyticsView onBack={() => setShowOwnerDashboard(false)} />
            ) : showOrderManagement ? (
              <OrderHistoryView
                orders={managedOrders}
                loading={ordersLoading}
                statusFilter={orderHistoryFilter}
                setStatusFilter={handleOrderHistoryFilterChange}
                onBack={handleBackFromOrderManagement}
                onApprove={handleApproveOrder}
                onReject={handleRejectOrder}
                onAdvanceStatus={handleAdvanceOrderStatus}
                actionId={orderActionId}
                isAdmin={activeUser.role === "admin"}
                lastUpdated={ordersLastUpdated}
              />
            ) : showMyOrders ? (
              <MyOrdersView
                orders={orders}
                loading={ordersLoading}
                onBack={handleBackFromOrders}
                onCancel={handleCancelOrder}
                actionId={orderActionId}
                lastUpdated={ordersLastUpdated}
              />
            ) : selectedRestaurant ? (
              <RestaurantDetailView
                selectedRestaurant={selectedRestaurant}
                setSelectedRestaurant={setSelectedRestaurant}
                activeUser={activeUser}
                groupedMenu={groupedMenu}
                activeCategoryFilter={activeCategoryFilter}
                setActiveCategoryFilter={setActiveCategoryFilter}
                setShowAddCategory={setShowAddCategory}
                setShowAddMenuItem={setShowAddMenuItem}
                setMenuItemForm={setMenuItemForm}
                canOrder={canOrder}
                cart={cart}
                onAddToCart={addToCart}
                onUpdateCartQty={updateCartQty}
                onOpenCheckout={() => setShowCheckout(true)}
                onRefreshMenu={() => fetchRestaurantMenu(selectedRestaurant.id)}
              />
            ) : (
              <RestaurantListView
                activeUser={activeUser}
                loading={loading}
                restaurants={restaurants}
                setShowAddRestaurant={setShowAddRestaurant}
                handleViewRestaurant={handleViewRestaurant}
                searchVal={searchVal}
                townshipVal={townshipVal}
                onApplyFilters={(search, township) => {
                  setSearchVal(search);
                  setTownshipVal(township);
                  fetchRestaurants(search, township);
                }}
              />
            )}
          </div>
        )}
      </main>

      <AddRestaurantModal
        showAddRestaurant={showAddRestaurant}
        setShowAddRestaurant={setShowAddRestaurant}
        restaurantForm={restaurantForm}
        setRestaurantForm={setRestaurantForm}
        handleCreateRestaurant={handleCreateRestaurant}
      />

      <AddCategoryModal
        showAddCategory={showAddCategory}
        setShowAddCategory={setShowAddCategory}
        categoryForm={categoryForm}
        setCategoryForm={setCategoryForm}
        handleCreateCategory={handleCreateCategory}
      />

      <AddMenuItemModal
        showAddMenuItem={showAddMenuItem}
        setShowAddMenuItem={setShowAddMenuItem}
        menuItemForm={menuItemForm}
        setMenuItemForm={setMenuItemForm}
        groupedMenu={groupedMenu}
        handleCreateMenuItem={handleCreateMenuItem}
      />

      <CheckoutModal
        showCheckout={showCheckout}
        setShowCheckout={setShowCheckout}
        cart={cart}
        deliveryAddress={deliveryAddress}
        setDeliveryAddress={setDeliveryAddress}
        onPlaceOrder={handlePlaceOrder}
        submitting={checkoutSubmitting}
        restaurantName={selectedRestaurant?.name || ""}
        restaurantId={selectedRestaurant?.id || ""}
      />
    </div>
  );
}
