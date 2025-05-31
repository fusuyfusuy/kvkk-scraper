# KVKK Data Breach Notification Scraper

## Project Purpose and Functionality

This project is a Python-based web scraper designed to monitor the Turkish Personal Data Protection Authority (KVKK) website for new data breach notifications. It automatically extracts information about these breaches, stores it in a local SQLite database, and logs its activities. The primary goal is to provide a timely and organized way to stay informed about publicly disclosed data security incidents.

## Features

*   **Web Scraping:** Regularly scrapes the KVKK's data breach notification page.
*   **Data Storage:** Stores extracted breach information (title, URL, date) in an SQLite database.
*   **Logging:** Maintains a log file (`scraper.log`) for tracking activity and troubleshooting.
*   **Basic Notifications:** (Future) Will include a system for notifying users of new breaches, potentially via email.

## How It Works

The scraper performs the following steps:

1.  **Fetches Webpage:** It downloads the HTML content of the KVKK's data breach notification page.
2.  **Parses Data:** It uses libraries like `requests` and `BeautifulSoup` to parse the HTML and identify relevant data points for each breach notification (e.g., title, link to the announcement, date of publication).
3.  **Database Interaction:**
    *   It connects to an SQLite database (`kvkk_breaches.db`).
    *   It checks if a breach notification already exists in the database to avoid duplicates.
    *   New breach notifications are inserted into the `blog_posts` table.
4.  **Logging:** All significant actions, errors, and new entries are logged to `scraper.log`.

## Setup and Usage

### Prerequisites

*   Python 3.x
*   Pip (Python package installer)

### Installation and Running

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Install Dependencies:**
    Open a terminal in the project directory and run:
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: You might need to create a `requirements.txt` file first if it doesn't exist. See Dependencies section below.)*

3.  **Database Setup:**
    The SQLite database (`database.db`) will be automatically created in the project's root directory when the scraper is run for the first time if it doesn't already exist. The `blog_posts` table structure is defined within the `scraper.py` script.

4.  **Running the Scraper:**
    Execute the main scraper script from the project's root directory:
    ```bash
    python scraper.py
    ```
    The scraper will then fetch the latest notifications and update the database.

## Dependencies

The project relies on the following Python libraries:

*   `requests`: For making HTTP requests to fetch the webpage.
*   `beautifulsoup4`: For parsing HTML content.
*   `sqlite3`: For interacting with the SQLite database (part of the Python standard library).
*   *(Potentially others if added, e.g., for email notifications)*

It's recommended to list these in a `requirements.txt` file for easy installation. You can create one by running:
```bash
pip freeze > requirements.txt
```
(After installing the necessary libraries manually for the first time: `pip install requests beautifulsoup4`)

## Database Schema

The scraper uses an SQLite database named `database.db` located in the project's root directory. It contains a single table:

**Table: `blog_posts`**

| Column        | Type    | Description                                                      |
| :------------ | :------ | :--------------------------------------------------------------- |
| `id`          | INTEGER | Primary Key, Auto-incrementing                                   |
| `title`       | TEXT    | The title of the data breach notification (must be unique).      |
| `post`        | TEXT    | The full text content of the data breach notification.           |
| `post_date`   | TEXT    | The extracted publication date of the notification (YYYY-MM-DD). |
| `scraped_date`| TEXT    | Timestamp (ISO format) of when the entry was scraped.            |
| `sent`        | INTEGER | Flag (0 for not sent, 1 for sent) for email notifications.       |

## Logging

The scraper logs its operations and any errors encountered to a file named `scraper.log` in the project's root directory. This file is useful for monitoring the scraper's activity and diagnosing issues.

## Future Improvements/TODOs

*   **Implement Full Email Notifications:** Develop a robust system to send email alerts when new breaches are found.
*   **Add Date Info from PDF:** Extract the actual date of the breach event from the PDF content itself, not just the publication date on the website. (from `todo.txt`)
*   **Cross-check Date with Title:** Verify date consistency by comparing it with information potentially in the title. (from `todo.txt`)
*   **More Granular Data Extraction:** Attempt to extract more specific details from the breach notification text/PDF, such as the number of people affected, type of data breached, etc.
*   **User Interface:** Develop a simple web interface or GUI to view and search the stored breach data.
*   **Configuration File:** Move settings like database name, target URL, and email configurations to an external config file.
*   **Error Handling & Retries:** Implement more sophisticated error handling and retry mechanisms for network issues.
*   **Unit Tests:** Develop a comprehensive suite of unit tests.
*   **Scheduling/Daemonization:** Set up the scraper to run automatically at regular intervals (e.g., using cron or as a background service).
*   **Delta Notifications:** Only notify about *newly added* breaches since the last check, rather than all breaches found in a run.
