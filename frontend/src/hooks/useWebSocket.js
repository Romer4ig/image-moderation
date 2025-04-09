import { useState, useEffect } from "react";
import io from "socket.io-client";

const SOCKET_URL = "http://localhost:5001";

export const useWebSocket = (setCollections) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    console.log("Connecting to Socket.IO...");
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("Socket.IO Connected!");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO Disconnected.");
      setIsConnected(false);
    });

    socket.on("generation_update", (data) => {
      console.log("Received generation_update via hook:", data);
      setLastMessage(data);

      if (data && data.id && data.status) {
        setCollections((prevCollections) =>
          prevCollections.map((coll) => {
            if (coll.id === data.collection_id && coll.cells && coll.cells[data.project_id]) {
              const updatedCells = { ...coll.cells };
              const cellToUpdate = updatedCells[data.project_id];
              let uiStatus = "unknown";
              if (data.status === "COMPLETED") {
                uiStatus = "generated_not_selected";
              } else if (data.status === "QUEUED" || data.status === "PENDING") {
                uiStatus = "queued";
              } else if (data.status === "FAILED") {
                uiStatus = "error";
              }
              updatedCells[data.project_id] = {
                ...cellToUpdate,
                generation_id: data.id,
                status: uiStatus,
                error_message: data.status === "FAILED" ? data.error : null,
                file_url:
                  data.status === "COMPLETED" && data.files && data.files.length > 0
                    ? data.files[0].url
                    : cellToUpdate.file_url,
                file_path:
                  data.status === "COMPLETED" && data.files && data.files.length > 0
                    ? data.files[0].file_path
                    : cellToUpdate.file_path,
              };
              return { ...coll, cells: updatedCells };
            }
            return coll;
          })
        );
      }
    });

    return () => {
      console.log("Disconnecting Socket.IO...");
      socket.disconnect();
    };
  }, [setCollections]);

  return { isConnected, lastMessage };
};
