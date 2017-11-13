import React from "react";

class ChatMessage extends React.Component {
    render() {
        return (
            <div className="chat-message">
                {this.props.user} at {this.props.time}: {this.props.text}
            </div>
        );
    }
}

export { ChatMessage };