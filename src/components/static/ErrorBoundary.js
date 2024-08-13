import React, { Component } from 'react';

class ErrorBoundary extends Component {
    err = null;
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.err = error;
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <h1>Something went wrong. ${this.err}</h1>;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
