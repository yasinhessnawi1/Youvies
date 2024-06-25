import React from 'react';
import LandingPage from "./pages/LandingPage";
import './styles/global.css';
import LoginPage from "./pages/LoginPage";
import {Route, BrowserRouter as Router, Switch} from "react-router-dom";
import {UserProvider} from "./contexts/UserContext";
import HomePage from "./pages/HomePage";


function App() {
    return (
        <Router >
            <UserProvider>
                <Switch>
                    <Route path="/login" component={LoginPage} />
                    <Route path="/" component={LandingPage} />
                    <Route path="/home/movie" component={HomePage } />
                </Switch>
            </UserProvider>
        </Router>
    );
}

export default App;

