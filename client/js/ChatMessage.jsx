import React from "react";

class ChatMessage extends React.Component {
    render() {
        return (
            <div className="chat-message">
                {this.props.user.realname} at {this.props.write_time}: {this.props.text}
            </div>
        );
    }
}

export { ChatMessage };
