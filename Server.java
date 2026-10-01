import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class Server {
    
    // Store the last uploaded CSV in memory for the AI assistant
    public static String lastCsvContent = "";
    
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(5000), 0);
        server.createContext("/upload", new UploadHandler());
        server.createContext("/chat", new ChatHandler());
        server.setExecutor(null); 
        server.start();
        System.out.println("Java server started on port 5000");
    }

    static class ChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    int nRead;
                    byte[] data = new byte[1024];
                    while ((nRead = is.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    String body = new String(buffer.toByteArray(), "UTF-8");
                    
                    // Super simple JSON parse for {"message": "..."}
                    String userMessage = "";
                    if (body.contains("\"message\"")) {
                        int start = body.indexOf("\"message\"") + 9;
                        int colon = body.indexOf(":", start);
                        int quote1 = body.indexOf("\"", colon);
                        int quote2 = body.indexOf("\"", quote1 + 1);
                        if (quote1 != -1 && quote2 != -1) {
                            userMessage = body.substring(quote1 + 1, quote2);
                        }
                    }

                    String apiKey = System.getenv("GEMINI_API_KEY");
                    if (apiKey == null || apiKey.trim().isEmpty()) {
                        String err = "{\"reply\":\"Error: GEMINI_API_KEY environment variable is not set. Please set it in your terminal before running the server.\"}";
                        exchange.getResponseHeaders().add("Content-Type", "application/json");
                        exchange.sendResponseHeaders(200, err.getBytes().length);
                        OutputStream os = exchange.getResponseBody();
                        os.write(err.getBytes());
                        os.close();
                        return;
                    }

                    // Truncate CSV to save tokens (first 50 lines max)
                    String csvSnippet = "";
                    if (lastCsvContent != null && !lastCsvContent.isEmpty()) {
                        String[] lines = lastCsvContent.split("\n");
                        int maxLines = Math.min(lines.length, 50);
                        StringBuilder sb = new StringBuilder();
                        for(int i=0; i<maxLines; i++){
                            sb.append(lines[i]).append("\n");
                        }
                        csvSnippet = sb.toString();
                    }

                    String prompt = "You are a helpful Data Analyst AI assistant. " +
                                    "Here is a snippet of the user's uploaded CSV data:\\n" +
                                    csvSnippet.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") +
                                    "\\n\\nUser question: " + userMessage.replace("\"", "\\\"");

                    // Build request payload for Gemini API
                    String jsonPayload = "{\"contents\":[{\"parts\":[{\"text\":\"" + prompt + "\"}]}]}";

                    URL url = new URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    
                    try(OutputStream os = conn.getOutputStream()) {
                        os.write(jsonPayload.getBytes("utf-8"));
                    }
                    
                    int responseCode = conn.getResponseCode();
                    InputStream responseStream = (responseCode >= 200 && responseCode < 300) ? conn.getInputStream() : conn.getErrorStream();
                    
                    BufferedReader in = new BufferedReader(new InputStreamReader(responseStream));
                    StringBuilder responseString = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        responseString.append(line);
                    }
                    in.close();
                    
                    // Simple parse to extract text from Gemini response
                    String reply = "Sorry, I could not understand the response.";
                    String respStr = responseString.toString();
                    int textStart = respStr.indexOf("\"text\": \"");
                    if (textStart != -1) {
                        textStart += 9;
                        int textEnd = respStr.indexOf("\"", textStart);
                        // handle escaped quotes within text
                        while (textEnd != -1 && respStr.charAt(textEnd - 1) == '\\') {
                            textEnd = respStr.indexOf("\"", textEnd + 1);
                        }
                        if (textEnd != -1) {
                            reply = respStr.substring(textStart, textEnd);
                            // Replace escaped newlines so JSON is valid
                            reply = reply.replace("\\n", "<br>");
                        }
                    }

                    String jsonRes = "{\"reply\":\"" + reply + "\"}";
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, jsonRes.getBytes("UTF-8").length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(jsonRes.getBytes("UTF-8"));
                    os.close();

                } catch (Exception e) {
                    e.printStackTrace();
                    String error = "{\"reply\":\"" + e.getMessage() + "\"}";
                    exchange.sendResponseHeaders(500, error.getBytes().length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(error.getBytes());
                    os.close();
                }
            } else {
                exchange.sendResponseHeaders(405, -1);
            }
        }
    }

    static class UploadHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    int nRead;
                    byte[] data = new byte[16384];
                    while ((nRead = is.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    byte[] bodyBytes = buffer.toByteArray();
                    String body = new String(bodyBytes, "UTF-8");

                    String[] lines = body.split("\r\n");
                    String boundary = lines[0];
                    
                    String filename = "uploaded.csv";
                    for (int i = 1; i < lines.length; i++) {
                        if (lines[i].contains("filename=")) {
                            int startQuote = lines[i].indexOf("filename=\"") + 10;
                            int endQuote = lines[i].indexOf("\"", startQuote);
                            if(startQuote != -1 && endQuote != -1) {
                                filename = lines[i].substring(startQuote, endQuote);
                            }
                            break;
                        }
                    }

                    int headerEnd = body.indexOf("\r\n\r\n");
                    if(headerEnd != -1) {
                        int contentStart = headerEnd + 4;
                        int boundaryEnd = body.lastIndexOf(boundary);
                        if(boundaryEnd != -1) {
                            int contentEnd = boundaryEnd - 2; 
                            if(contentEnd > contentStart) {
                                String csvContent = body.substring(contentStart, contentEnd);
                                // Store it in memory for the chat
                                lastCsvContent = csvContent;
                                processCsv(exchange, csvContent, filename);
                                return;
                            }
                        }
                    }
                    
                    String error = "{\"error\":\"Could not parse file\"}";
                    exchange.sendResponseHeaders(400, error.getBytes().length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(error.getBytes());
                    os.close();
                } catch (Exception e) {
                    e.printStackTrace();
                    String error = "{\"error\":\"" + e.getMessage() + "\"}";
                    exchange.sendResponseHeaders(500, error.getBytes().length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(error.getBytes());
                    os.close();
                }
            } else {
                exchange.sendResponseHeaders(405, -1);
            }
        }
        
        private void processCsv(HttpExchange exchange, String csvContent, String filename) throws IOException {
            String[] rows = csvContent.split("\n");
            
            if (rows.length <= 1) {
                 String res = "{\"error\":\"Empty or invalid CSV\"}";
                 exchange.sendResponseHeaders(400, res.getBytes().length);
                 OutputStream os = exchange.getResponseBody();
                 os.write(res.getBytes());
                 os.close();
                 return;
            }
            
            int totalRows = rows.length - 1; // excluding header
            String header = rows[0];
            int columns = header.split(",", -1).length;
            
            Set<String> uniqueRows = new HashSet<>();
            int duplicates = 0;
            int missingCells = 0;
            int invalidRecords = 0;
            
            for (int i = 1; i < rows.length; i++) {
                String row = rows[i].trim();
                if (row.isEmpty()) {
                    totalRows--;
                    continue;
                }
                
                if (!uniqueRows.add(row)) {
                    duplicates++;
                }
                
                int rowMissing = 0;
                String[] cols = row.split(",", -1);
                for(String c : cols) {
                    if(c.trim().isEmpty()) rowMissing++;
                }
                
                if (cols.length < columns) {
                    rowMissing += (columns - cols.length);
                }
                
                missingCells += rowMissing;
                if (rowMissing > 0) {
                    invalidRecords++;
                }
            }
            
            if(totalRows <= 0) {
                totalRows = 1; // avoid division by zero
            }
            
            int totalCells = totalRows * columns;
            
            double completeness = totalCells == 0 ? 100.0 : Math.max(0.0, 100.0 - ((double)missingCells / totalCells * 100.0));
            double uniqueness = totalRows == 0 ? 100.0 : Math.max(0.0, 100.0 - ((double)duplicates / totalRows * 100.0));
            double validity = totalRows == 0 ? 100.0 : Math.max(0.0, 100.0 - ((double)invalidRecords / totalRows * 100.0));
            double accuracy = (validity + completeness) / 2.0;
            double consistency = (uniqueness + completeness) / 2.0;
            double timeliness = completeness;
            
            double score = (completeness + accuracy + consistency + validity + uniqueness + timeliness) / 6.0;
            
            String json = String.format(
                "{\"filename\":\"%s\",\"total_rows\":%d,\"columns\":%d,\"duplicates\":%d,\"invalid_records\":%d,\"score\":%d,\"completeness\":%d,\"accuracy\":%d,\"consistency\":%d,\"validity\":%d,\"uniqueness\":%d,\"timeliness\":%d}",
                filename, totalRows, columns, duplicates, invalidRecords, 
                (int)score, (int)completeness, (int)accuracy, (int)consistency, (int)validity, (int)uniqueness, (int)timeliness
            );
            
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, json.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(json.getBytes());
            os.close();
        }
    }
}
