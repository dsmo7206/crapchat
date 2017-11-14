import React from "react";

class ChatSummary extends React.Component {
    render() {
        const message = (
            this.props.hasActivity ? 
            this.props.lastMessage.text :
            '(No activity)'
        );

        const summaryClassName = (
            this.props.isSelected ? "chat-summary-selected" : "chat-summary"
        );

        return (
            <div className={summaryClassName} onClick={() => {this.props.onClicked(this.props.chatid)}}>
                <div className="chat-summary-title">
                    Chat {this.props.chatid}
                </div>
                <div className="chat-summary-message">
                    {message}
                </div>
            </div>
        );
    }
}

export { ChatSummary };