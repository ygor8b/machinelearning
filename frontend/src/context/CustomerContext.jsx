import { createContext, useContext, useState } from "react";

const CustomerContext = createContext(null);

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedCustomer") || "null");
    } catch {
      return null;
    }
  });

  const select = (c) => {
    setCustomer(c);
    localStorage.setItem("selectedCustomer", JSON.stringify(c));
  };

  const clear = () => {
    setCustomer(null);
    localStorage.removeItem("selectedCustomer");
  };

  return (
    <CustomerContext.Provider value={{ customer, select, clear }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  return useContext(CustomerContext);
}
