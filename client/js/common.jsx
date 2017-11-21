function dateToString(dateString, today)
{
    // The "date" here is a string from the Python backend;
    // it turns out that we can construct a Date directly from it.
    const date = new Date(dateString);

    if (date.getFullYear() == today.getFullYear() && date.getMonth() == today.getMonth() && date.getDate() == today.getDate())
    {
        // The message was written today
        return date.toTimeString().substr(0, 5);
    }
    else
    {
        // The message was written on a different date
        return date.toDateString().substring(4, 10);
    }
}

export { dateToString };
