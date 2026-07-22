namespace QuizNest.Api.Models;

public class ScoreSubmission
{
    public required string Username { get; set; }
    public required string CategoryId { get; set; }
    public int XpEarned { get; set; }
}
