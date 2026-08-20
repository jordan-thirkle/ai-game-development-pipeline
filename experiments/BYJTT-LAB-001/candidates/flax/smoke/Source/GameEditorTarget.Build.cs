using Flax.Build;

public class GameEditorTarget : GameProjectEditorTarget
{
    public override void Init()
    {
        base.Init();
        Modules.Add("Game");
    }
}
