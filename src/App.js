import React from 'react';
import LandingPage from "./pages/LandingPage";
import './styles/global.css';
import LoginPage from "./pages/LoginPage";
import {Route, BrowserRouter as Router, Switch} from "react-router-dom";
import {UserProvider} from "./contexts/UserContext";


function App() {
    return (
        <Router >
            <UserProvider>
                <Switch>
                    <Route path="/login" component={LoginPage} />
                    <Route path="/" component={LandingPage} />
                </Switch>
            </UserProvider>
        </Router>
    );
}

export default App;

