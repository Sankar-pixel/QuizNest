namespace QuizNest.Api.Models;

public class UserDto
{
    public int Id { get; set; }
    public required string Username { get; set; }
    public int Level { get; set; }
    public int Xp { get; set; }
    public required string AvatarConfig { get; set; }
    public required DateTime CreatedAt { get; set; }
}
