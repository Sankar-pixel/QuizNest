namespace QuizNest.Api.Models;

public class User
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public int Level { get; set; } = 1;
    public int Xp { get; set; } = 0;
    public string AvatarConfig { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
