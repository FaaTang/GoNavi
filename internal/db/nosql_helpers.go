package db

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)
func collectColumns(rows []map[string]interface{}) []string {
	set := make(map[string]struct{})
	for _, row := range rows {
		for key := range row {
			set[key] = struct{}{}
		}
	}
	cols := make([]string, 0, len(set))
	for key := range set {
		cols = append(cols, key)
	}
	sort.Strings(cols)
	for _, priority := range []string{"id", "query_index", "document", "distance", "metadata", "embedding"} {
		for i, col := range cols {
			if col == priority && i > 0 {
				cols = append(cols[:i], cols[i+1:]...)
				cols = append([]string{priority}, cols...)
				break
			}
		}
	}
	return cols
}

func tableNameOrDB(dbName, tableName string) string {
	if name := strings.TrimSpace(tableName); name != "" {
		return name
	}
	return strings.TrimSpace(dbName)
}

func inferChromaValueType(value interface{}) string {
	switch value.(type) {
	case bool:
		return "bool"
	case json.Number, float64, float32, int, int64:
		return "number"
	case map[string]interface{}:
		return "json"
	case []interface{}:
		return "array"
	default:
		return "string"
	}
}

func firstStringValue(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			text := strings.TrimSpace(fmt.Sprintf("%v", value))
			if text != "" && text != "<nil>" {
				return text
			}
		}
	}
	return ""
}

func firstExisting(m map[string]interface{}, keys ...string) interface{} {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return value
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if text := strings.TrimSpace(value); text != "" {
			return text
		}
	}
	return ""
}

func hasAnyKey(m map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		if _, ok := m[key]; ok {
			return true
		}
	}
	return false
}

func getOrBool(m map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		switch v := m[key].(type) {
		case bool:
			return v
		case string:
			return strings.EqualFold(strings.TrimSpace(v), "true")
		}
	}
	return false
}

func intFromAny(value interface{}, fallback int) int {
	switch v := value.(type) {
	case json.Number:
		n, err := v.Int64()
		if err == nil {
			return int(n)
		}
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err == nil {
			return n
		}
	}
	return fallback
}
func mapString(m map[string]interface{}, key string) string {
	return strings.TrimSpace(fmt.Sprintf("%v", m[key]))
}
func stringSliceFromAny(value interface{}, fallback []string) []string {
	if value == nil {
		return fallback
	}
	switch v := value.(type) {
	case []string:
		return v
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if text := strings.TrimSpace(fmt.Sprintf("%v", item)); text != "" {
				result = append(result, text)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return fallback
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func mqttEncodePayload(payload interface{}) ([]byte, error) {
	switch typed := payload.(type) {
	case nil:
		return []byte{}, nil
	case []byte:
		return typed, nil
	case string:
		return []byte(typed), nil
	default:
		return json.Marshal(typed)
	}
}

func mqttDecodePayload(payload []byte) (interface{}, string) {
	if payload == nil {
		return nil, "text"
	}
	var decoded interface{}
	if err := decodeJSONWithUseNumber(payload, &decoded); err == nil {
		return decoded, "json"
	}
	if utf8.Valid(payload) {
		return string(payload), "text"
	}
	return base64.StdEncoding.EncodeToString(payload), "base64"
}

func anySlice(value interface{}) []interface{} {
	switch v := value.(type) {
	case []interface{}:
		return v
	case []string:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = item
		}
		return result
	default:
		return nil
	}
}

func normalizeJSONLikeValue(value interface{}) interface{} {
	switch value.(type) {
	case map[string]interface{}, []interface{}:
		payload, err := json.Marshal(value)
		if err == nil {
			return string(payload)
		}
	}
	return value
}
