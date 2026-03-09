import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { AuthContext } from "./AuthContext";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    console.log("⚛️ [SocketProvider] Render. User:", user?._id, "Loading:", loading);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        console.log("🎬 [SocketProvider] Effect triggered. UserID:", user?._id);
        // For this app, most real-time features require auth.

        // Cleanup any existing socket before recreating
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const session = localStorage.getItem("app_session");
        let token = "";
        if (session) {
            try {
                const parsed = JSON.parse(session);
                token = parsed.token || "";
            } catch (e) {
                console.error("Failed to parse session for socket token", e);
            }
        }

        // GUARD: If no user or no token, ensure we are disconnected and stop.
        if (!user?._id || !token) {
            if (socketRef.current) {
                console.log("🔌 Stopping global WS (No session/user)");
                socketRef.current.disconnect();
                socketRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        console.log(`🔌 [Socket Attempt] URL: ${socketUrl} | Token present: ${!!token}`);

        const socket = io(socketUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socket.on("connect_error", (err) => {
            console.error("🌐 Global WS connection error:", err.message);
        });

        socket.on("connect", () => {
            console.log("🌐 Global WS connected:", socket.id);
            setIsConnected(true);

            // Auto-join user room for personal notifications
            if (user?._id) {
                socket.emit("user:join", user._id);
            }
        });

        socket.on("disconnect", (reason) => {
            console.log("🌐 Global WS disconnected:", reason);
            setIsConnected(false);
        });

        socketRef.current = socket;

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [user?._id]); // Re-connect if user changes (login/logout)

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
