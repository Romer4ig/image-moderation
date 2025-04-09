import React from "react";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import { Link } from "react-router-dom";

const Layout = ({ children, isConnected }) => {
  return (
    <div className="App"> 
      <Navbar bg="primary" variant="dark" expand="lg" sticky="top">
        <Container fluid>
          <Navbar.Brand as={Link} to="/">
            Обложки сборников (WS: {isConnected ? "✅" : "❌"})
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Nav.Link as={Link} to="/projects">
                Проекты
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid className="mt-4">
        {children} 
      </Container>
    </div>
  );
};

export default Layout; 