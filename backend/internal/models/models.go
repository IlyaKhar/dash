package models

import "time"

// Роли пользователей.
const (
	RoleLab   = "lab"   // лаборант
	RoleAdmin = "admin" // администратор
)

func ValidRole(r string) bool {
	return r == RoleLab || r == RoleAdmin
}

type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	Name         string     `json:"name"`
	Role         string     `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	PasswordHash string     `json:"-"`
}

// UserWithStats — расширенная запись для админ-панели.
type UserWithStats struct {
	User
	TasksTotal int `json:"tasks_total"`
	TasksOpen  int `json:"tasks_open"`
}

type Folder struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	Total     int       `json:"total"`
	Open      int       `json:"open"`
}

type Task struct {
	ID            string     `json:"id"`
	OwnerID       string     `json:"owner_id"`
	OwnerName     string     `json:"owner_name"`
	FolderID      *string    `json:"folder_id"`
	Title         string     `json:"title"`
	Body          string     `json:"body"`
	Done          bool       `json:"done"`
	Pinned        bool       `json:"pinned"`
	DueAt         *time.Time `json:"due_at"`
	CommentsCount int        `json:"comments_count"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type Comment struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	AuthorID    string    `json:"author_id"`
	AuthorName  string    `json:"author_name"`
	AuthorEmail string    `json:"author_email"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Stats — сводка для админ-панели.
type Stats struct {
	Users       int `json:"users"`
	Admins      int `json:"admins"`
	Labs        int `json:"labs"`
	Blocked     int `json:"blocked"`
	Tasks       int `json:"tasks"`
	TasksOpen   int `json:"tasks_open"`
	TasksToday  int `json:"tasks_today"`
	Overdue     int `json:"overdue"`
	NewUsers7d  int `json:"new_users_7d"`
	ActiveUsers int `json:"active_users_7d"`
}

// AuditEntry — журнал административных действий.
type AuditEntry struct {
	ID         int64     `json:"id"`
	ActorEmail string    `json:"actor_email"`
	Action     string    `json:"action"`
	TargetID   *string   `json:"target_id"`
	TargetName string    `json:"target_email"`
	Details    string    `json:"details"`
	CreatedAt  time.Time `json:"created_at"`
}
