import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import GenerationGrid from './components/GenerationGrid'
import './App.css'

// URL нашего Flask-SocketIO сервера
const SOCKET_URL = 'http://localhost:5001'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [collections, setCollections] = useState([])
  const [gridLoading, setGridLoading] = useState(true)
  const [gridError, setGridError] = useState(null)

  useEffect(() => {
    console.log('Connecting to Socket.IO...')
    const socket = io(SOCKET_URL)

    socket.on('connect', () => {
      console.log('Socket.IO Connected!')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Socket.IO Disconnected.')
      setIsConnected(false)
    })

    // Слушаем кастомное событие 'generation_update'
    socket.on('generation_update', (data) => {
      console.log('Received generation_update:', data)
      setLastMessage(data) // Сохраняем последнее сообщение для отображения
      
      // --- Логика обновления состояния коллекций --- 
      if (data && data.id && data.status) {
          setCollections(prevCollections => 
              prevCollections.map(coll => {
                  // Ищем нужную коллекцию и проект
                  if (coll.id === data.collection_id && coll.cells && coll.cells[data.project_id]) {
                      // Создаем копию ячеек и обновляем нужную
                      const updatedCells = { ...coll.cells };
                      const cellToUpdate = updatedCells[data.project_id];
                      
                      // Определяем новый статус для UI
                      let uiStatus = 'unknown';
                      if (data.status === 'COMPLETED') {
                           // Нужен способ определить, выбрана ли эта генерация?
                           // Пока предполагаем, что если пришло обновление COMPLETED, она не выбрана.
                           // Логика is_selected должна обновляться через другой механизм (после выбора в модалке).
                           uiStatus = 'generated_not_selected'; 
                      } else if (data.status === 'QUEUED' || data.status === 'PENDING') {
                           uiStatus = 'queued';
                      } else if (data.status === 'FAILED') {
                           uiStatus = 'error';
                      }
                      
                      // Обновляем данные ячейки
                      updatedCells[data.project_id] = {
                          ...cellToUpdate,
                          generation_id: data.id, // Обновляем ID генерации
                          status: uiStatus,
                          error_message: data.status === 'FAILED' ? data.error : null,
                          // Обновляем URL файла, если он пришел (предполагаем, что data.files - массив)
                          file_url: (data.status === 'COMPLETED' && data.files && data.files.length > 0) ? data.files[0].url : cellToUpdate.file_url,
                          file_path: (data.status === 'COMPLETED' && data.files && data.files.length > 0) ? data.files[0].file_path : cellToUpdate.file_path,
                          // is_selected остается прежним, обновляется отдельно
                      };
                      // Возвращаем обновленную коллекцию
                      return { ...coll, cells: updatedCells };
                  } else {
                      // Если коллекция или ячейка не та, возвращаем без изменений
                      return coll;
                  }
              })
          );
      } // конец if (data && data.id && data.status)
    })

    // Очистка при размонтировании компонента
    return () => {
      console.log('Disconnecting Socket.IO...')
      socket.disconnect()
    }
  }, []) // Пустой массив зависимостей - запускаем эффект один раз

  return (
    <div className="App"> {/* Используем класс App для возможных стилей */} 
      <h1>Image Generation Dashboard</h1>
      <p>Socket.IO Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      
      {/* Отображаем последнее сообщение для отладки */} 
      {lastMessage && (
        <div style={{ margin: '10px', padding: '10px', border: '1px solid green' }}>
          <strong>Last Generation Update:</strong>
          <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
        </div>
      )}

      {/* Передаем состояние и сеттеры в грид */}
      <GenerationGrid 
          collections={collections}
          setCollections={setCollections}
          gridLoading={gridLoading}
          setGridLoading={setGridLoading}
          gridError={gridError}
          setGridError={setGridError}
      />
      
      {/* Убираем старый тестовый код */}
      {/* 
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <h2>Message from Backend: {message}</h2>
      <div className="card">
         <h3>Test Automatic1111 Connection</h3>
         <button onClick={handleTestA1111}>
           Test A1111 API Call
         </button>
         <p>Status: {a1111Status}</p>
      </div>
      <div className="card">
         <h3>Test Database Connection</h3>
         <button onClick={handleTestDb}>
           Test DB Connection
         </button>
         <p>Status: {dbStatus}</p>
      </div>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      */}
    </div>
  )
}

export default App
