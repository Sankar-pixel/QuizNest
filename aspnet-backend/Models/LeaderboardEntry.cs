namespace QuizNest.Api.Models;

public class LeaderboardEntry
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string CategoryId { get; set; }
    public int XpEarned { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
