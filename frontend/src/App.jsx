import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import GenerationGrid from './components/GenerationGrid'
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
// Импортируем компоненты для роутинга
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'; 
// Импортируем новую страницу
import ProjectsPage from './pages/ProjectsPage'; 
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
    // Оборачиваем все в Router
    <Router>
      <div className="App">
        {/* --- Navbar --- */}
        <Navbar bg="primary" variant="dark" expand="lg" sticky="top">
          <Container fluid>
            {/* Используем Link для навигации */}
            <Navbar.Brand as={Link} to="/">Обложки сборников</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="ms-auto">
                {/* Добавляем ссылку на страницу проектов */} 
                <Nav.Link as={Link} to="/projects">Проекты</Nav.Link>
                <Nav.Link href="#link">Document Link</Nav.Link> {/* Оставляем старую ссылку как пример */} 
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        {/* --- Основной контент с роутингом --- */}
        <Container fluid className="mt-4">
          {/* Определяем маршруты */}
          <Routes>
            {/* Главная страница (сетка генераций) */}
            <Route path="/" element={ 
              <>
                 <h1>Сравнение и выбор обложек</h1>
                 <p>Socket.IO Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
                 {/* Отладочное сообщение */}
                 {lastMessage && (
                   <div style={{ margin: '10px', padding: '10px', border: '1px solid green' }}>
                     <strong>Last Generation Update:</strong>
                     <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
                   </div>
                 )}
                 <GenerationGrid 
                     collections={collections}
                     setCollections={setCollections}
                     gridLoading={gridLoading}
                     setGridLoading={setGridLoading}
                     gridError={gridError}
                     setGridError={setGridError}
                 />
              </> 
            } />
            {/* Страница проектов */} 
            <Route path="/projects" element={<ProjectsPage />} /> 
          </Routes>
        </Container>
      </div>
    </Router>
  )
}

export default App
