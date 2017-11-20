import React from "react";

class ChatSummary extends React.Component {
    render() {
        const message = (
            this.props.hasActivity ? 
            this.props.lastMessage.text :
            '(No messages)'
        );

        const summaryClassName = (
            this.props.isSelected ? "chat-summary-selected" : "chat-summary"
        );

        return (
            <div className={summaryClassName} onClick={() => {this.props.onClicked(this.props.chatid)}}>
                <div className="chat-summary-title">
                    {this.props.name}
                </div>
                <div className="chat-summary-message">
                    {message}
                </div>
                <button onClick={(event) => {
                    this.props.leaveChat(this.props.chatid);
                    event.stopPropagation();
                }}/>
            </div>
        );
    }
}

export { ChatSummary };