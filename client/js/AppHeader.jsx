import React from "react";

class AppHeader extends React.Component {
    render() {
        return (
            <div className="app-header">
                <p>Crapchat! Pure crapness since 2017</p>
                <button className="app-header-logout" onClick={this.props.logout}>Logout</button>
            </div>
        );
    }
}

export { AppHeader };