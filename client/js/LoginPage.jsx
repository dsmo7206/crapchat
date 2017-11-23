import React from "react";

class LoginPage extends React.Component {
    constructor() {
        super();
        this.state = {
            username: '',
            password: '',
            errorMessage: ''
        }

        this.onUsernameChange = this.onUsernameChange.bind(this);
        this.onPasswordChange = this.onPasswordChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
        this.onLoginSuccess = this.onLoginSuccess.bind(this);
        this.onLoginFail = this.onLoginFail.bind(this);
    }

    onUsernameChange(event) {
        this.setState({username: event.target.value})
    }

    onPasswordChange(event) {
        this.setState({password: event.target.value})
    }

    onSubmit(event) {
        event.preventDefault();
        this.props.tryLogin(this.state.username, this.state.password);
    }

    onLoginSuccess(message) {
        this.setState({
            username: '',
            password: '',
            errorMessage: ''
        });
    }

    onLoginFail(message) {
        this.setState({errorMessage: message});
    }

    render() {
        return (
            <div className="login">
                <form onSubmit={this.onSubmit}>
                    <label>
                        Username:
                        <input type="text" value={this.state.username} onChange={this.onUsernameChange}/>
                    </label>
                    <label>
                        Password:
                        <input type="password" value={this.state.password} onChange={this.onPasswordChange}/>
                    </label>
                    <input type="submit" value="Login"/>
                </form>
                <div className="login=error">
                    {this.state.errorMessage}
                </div>
            </div>
        );
    }
}

export { LoginPage };
